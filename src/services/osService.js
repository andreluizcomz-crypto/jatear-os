import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { registrarLog } from './logsService';

const FORMATO_NUMERO = /^OS-(\d{4})-(\d{4})$/;

export function validarNumeroOS(numero) {
  return FORMATO_NUMERO.test(numero);
}

function partesNumero(numero) {
  const partes = numero.match(FORMATO_NUMERO);
  return { ano: Number(partes[1]), sequencial: Number(partes[2]) };
}

// Sugestão de número para o formulário (não consome o contador;
// o consumo acontece na transação de criação)
export async function sugerirNumeroOS() {
  const ano = new Date().getFullYear();
  const contador = await getDoc(doc(db, 'contadores', `os_${ano}`));
  const proximo = (contador.exists() ? contador.data().ultimoNumero : 0) + 1;
  return `OS-${ano}-${String(proximo).padStart(4, '0')}`;
}

// Verifica unicidade do número (regra: número nunca é reutilizado)
export async function numeroDisponivel(numero, ignorarOsId) {
  const resultado = await getDocs(
    query(collection(db, 'ordens_servico'), where('numero', '==', numero))
  );
  return resultado.docs.every((d) => d.id === ignorarOsId);
}

const TOTAIS_ZERADOS = {
  qtdItens: 0,
  itensConcluidos: 0,
  itensFaturados: 0,
  pesoTotalKg: 0,
  areaTotalM2: 0,
  valorTotal: 0,
  valorFaturado: 0,
  valorAFaturar: 0,
};

// Status derivado da OS a partir dos itens (especificação 6.2)
export function derivarStatusOS(itens) {
  if (itens.length === 0) return 'aberta';
  const ativos = itens.filter((i) => i.status !== 'cancelado');
  // Todos os itens cancelados: "todos concluído/entregue/cancelado" → concluída
  if (ativos.length === 0) return 'concluida';
  if (ativos.every((i) => i.status === 'recebido')) return 'aberta';
  if (ativos.every((i) => i.status === 'faturado')) return 'faturada';
  if (ativos.some((i) => i.status === 'faturado')) return 'parcialmente_faturada';
  if (ativos.every((i) => ['concluido', 'entregue'].includes(i.status))) return 'concluida';
  return 'em_execucao';
}

export function calcularTotaisOS(itens) {
  const ativos = itens.filter((i) => i.status !== 'cancelado');
  const soma = (fn) => Number(ativos.reduce((total, i) => total + (fn(i) || 0), 0).toFixed(2));
  const totais = {
    qtdItens: ativos.length,
    itensConcluidos: ativos.filter((i) =>
      ['concluido', 'entregue', 'faturado'].includes(i.status)
    ).length,
    itensFaturados: ativos.filter((i) => i.faturado === true).length,
    pesoTotalKg: soma((i) => i.pesoTotalKg),
    areaTotalM2: soma((i) => i.areaTotalM2),
    valorTotal: soma((i) => i.valorTotalItem),
    valorFaturado: Number(
      ativos
        .filter((i) => i.faturado === true)
        .reduce((total, i) => total + (i.valorTotalItem || 0), 0)
        .toFixed(2)
    ),
  };
  totais.valorAFaturar = Number((totais.valorTotal - totais.valorFaturado).toFixed(2));
  return totais;
}

export async function listarOS() {
  const resultado = await getDocs(
    query(collection(db, 'ordens_servico'), orderBy('numero', 'desc'))
  );
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function buscarOS(id) {
  const registro = await getDoc(doc(db, 'ordens_servico', id));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}

// Criação com transação sobre o contador: se o número (sugerido ou editado)
// for maior que o último usado, o contador avança para evitar colisão futura.
export async function criarOS(cabecalho, uid) {
  if (!validarNumeroOS(cabecalho.numero)) throw new Error('numero-invalido');
  if (!(await numeroDisponivel(cabecalho.numero))) throw new Error('numero-duplicado');

  const { ano, sequencial } = partesNumero(cabecalho.numero);
  const osRef = doc(collection(db, 'ordens_servico'));

  await runTransaction(db, async (transacao) => {
    const contadorRef = doc(db, 'contadores', `os_${ano}`);
    // Reserva do número dentro da transação — impede que dois usuários
    // criando OS ao mesmo tempo gravem o mesmo número
    const reservaRef = doc(db, 'numeros_os', cabecalho.numero);
    const [contador, reserva] = await Promise.all([
      transacao.get(contadorRef),
      transacao.get(reservaRef),
    ]);
    if (reserva.exists()) throw new Error('numero-duplicado');
    const ultimo = contador.exists() ? contador.data().ultimoNumero : 0;
    if (sequencial > ultimo) {
      transacao.set(contadorRef, { prefixo: 'OS', ano, ultimoNumero: sequencial });
    }
    transacao.set(reservaRef, { osId: osRef.id, criadoEm: serverTimestamp() });
    transacao.set(osRef, {
      ...cabecalho,
      numeroSequencial: sequencial,
      ano,
      status: 'aberta',
      statusFaturamento: 'nao_faturada',
      totais: TOTAIS_ZERADOS,
      motivoCancelamento: '',
      criadoPor: uid,
      criadoEm: serverTimestamp(),
      atualizadoPor: uid,
      atualizadoEm: serverTimestamp(),
    });
  });

  registrarLog('os_criada', 'ordens_servico', osRef.id, { numero: cabecalho.numero }, uid);
  return osRef.id;
}

// Atualiza o cabeçalho; se número/cliente/subcliente mudarem, sincroniza os
// campos desnormalizados dos itens no mesmo lote.
export async function atualizarCabecalhoOS(osId, cabecalho, anterior, itens, uid) {
  if (!validarNumeroOS(cabecalho.numero)) throw new Error('numero-invalido');

  const numeroMudou = cabecalho.numero !== anterior.numero;
  const clienteMudou = cabecalho.clienteId !== anterior.clienteId;

  if (clienteMudou && itens.some((i) => i.faturado === true)) {
    throw new Error('cliente-bloqueado'); // regra 7.12
  }
  if (numeroMudou) {
    if (!(await numeroDisponivel(cabecalho.numero, osId))) throw new Error('numero-duplicado');
    const { ano, sequencial } = partesNumero(cabecalho.numero);
    await runTransaction(db, async (transacao) => {
      const contadorRef = doc(db, 'contadores', `os_${ano}`);
      const reservaRef = doc(db, 'numeros_os', cabecalho.numero);
      const [contador, reserva] = await Promise.all([
        transacao.get(contadorRef),
        transacao.get(reservaRef),
      ]);
      if (reserva.exists() && reserva.data().osId !== osId) {
        throw new Error('numero-duplicado');
      }
      const ultimo = contador.exists() ? contador.data().ultimoNumero : 0;
      if (sequencial > ultimo) {
        transacao.set(contadorRef, { prefixo: 'OS', ano, ultimoNumero: sequencial });
      }
      // A reserva do número antigo permanece — número nunca é reutilizado
      transacao.set(reservaRef, { osId, criadoEm: serverTimestamp() });
    });
    registrarLog(
      'os_numero_alterado',
      'ordens_servico',
      osId,
      { de: anterior.numero, para: cabecalho.numero },
      uid
    );
  }

  const { ano, sequencial } = partesNumero(cabecalho.numero);
  const lote = writeBatch(db);
  lote.update(doc(db, 'ordens_servico', osId), {
    ...cabecalho,
    numeroSequencial: sequencial,
    ano,
    atualizadoPor: uid,
    atualizadoEm: serverTimestamp(),
  });

  const desnormalizadosMudaram =
    numeroMudou || clienteMudou || cabecalho.subclienteNome !== anterior.subclienteNome;
  if (desnormalizadosMudaram) {
    itens
      .filter((i) => i.id)
      .forEach((item) => {
        lote.update(doc(db, 'ordens_servico', osId, 'itens', item.id), {
          osNumero: cabecalho.numero,
          clienteId: cabecalho.clienteId,
          clienteNome: cabecalho.clienteNome,
          subclienteNome: cabecalho.subclienteNome,
        });
      });
  }
  await lote.commit();
  registrarLog('os_cabecalho_atualizado', 'ordens_servico', osId, { numero: cabecalho.numero }, uid);
}

// Cancelamento manual da OS (exige justificativa; nunca é excluída)
export async function cancelarOS(osId, motivo, uid) {
  await updateDoc(doc(db, 'ordens_servico', osId), {
    status: 'cancelada',
    motivoCancelamento: motivo,
    atualizadoPor: uid,
    atualizadoEm: serverTimestamp(),
  });
  registrarLog('os_cancelada', 'ordens_servico', osId, { motivo }, uid);
}

// Recalcula status e totais derivados a partir dos itens gravados
export async function recalcularOS(osId) {
  const resultado = await getDocs(collection(db, 'ordens_servico', osId, 'itens'));
  const itens = resultado.docs.map((d) => d.data());
  const os = await buscarOS(osId);
  if (!os || os.status === 'cancelada') return;
  const totais = calcularTotaisOS(itens);
  const statusFaturamento =
    totais.itensFaturados === 0
      ? 'nao_faturada'
      : totais.itensFaturados === totais.qtdItens
        ? 'faturada'
        : 'parcial';
  await updateDoc(doc(db, 'ordens_servico', osId), {
    status: derivarStatusOS(itens),
    statusFaturamento,
    totais,
  });
}
