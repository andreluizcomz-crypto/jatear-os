import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { registrarLog } from './logsService';
import { recalcularOS } from './osService';

// Recalcula os campos derivados de um item (pesos, áreas e valores).
// Os campos digitáveis são preservados como o usuário digitou (inclusive
// vazios, para poder apagar e redigitar) — a conversão para número
// acontece só na gravação (coergirNumericos).
export function calcularItem(item) {
  const quantidade = Number(item.quantidade) || 0;
  const pesoUnitarioKg = Number(item.pesoUnitarioKg) || 0;
  const areaUnitariaM2 = Number(item.areaUnitariaM2) || 0;
  const pesoTotalKg = Number((quantidade * pesoUnitarioKg).toFixed(2));
  const areaTotalM2 = Number((quantidade * areaUnitariaM2).toFixed(2));

  const servicos = (item.servicos || []).map((servico) => ({
    ...servico,
    valor: Number(
      ((Number(servico.quantidadeCobrada) || 0) * (Number(servico.precoUnitario) || 0)).toFixed(2)
    ),
  }));

  return {
    ...item,
    pesoTotalKg,
    areaTotalM2,
    servicos,
    valorTotalItem: Number(servicos.reduce((total, s) => total + s.valor, 0).toFixed(2)),
  };
}

// Converte os campos digitáveis para número antes de gravar no banco
function coergirNumericos(item) {
  return {
    ...item,
    quantidade: Number(item.quantidade) || 0,
    pesoUnitarioKg: Number(item.pesoUnitarioKg) || 0,
    areaUnitariaM2: Number(item.areaUnitariaM2) || 0,
    servicos: (item.servicos || []).map((servico) => ({
      ...servico,
      quantidadeCobrada: Number(servico.quantidadeCobrada) || 0,
      precoUnitario: Number(servico.precoUnitario) || 0,
    })),
  };
}

// Sugestão de quantidade cobrada conforme a unidade (especificação 4.4)
export function sugerirQuantidadeCobrada(unidade, item) {
  const calculado = calcularItem(item);
  if (unidade === 'm2') return calculado.areaTotalM2;
  if (unidade === 'kg') return calculado.pesoTotalKg;
  if (unidade === 'peca') return Number(calculado.quantidade) || 0;
  return 0; // hora e verba: digitação manual
}

export async function listarItens(osId) {
  const resultado = await getDocs(
    query(collection(db, 'ordens_servico', osId, 'itens'), orderBy('sequencia'))
  );
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Grava em lote os itens alterados/novos e recalcula a OS
export async function salvarItens(osId, cabecalho, itens, uid) {
  const lote = writeBatch(db);
  const colecao = collection(db, 'ordens_servico', osId, 'itens');
  let novos = 0;
  let alterados = 0;

  const itensComId = itens.map((item) => {
    const calculado = calcularItem(coergirNumericos(item));
    const dados = {
      ...calculado,
      osId,
      osNumero: cabecalho.numero,
      clienteId: cabecalho.clienteId,
      clienteNome: cabecalho.clienteNome,
      subclienteNome: cabecalho.subclienteNome || '',
      atualizadoEm: serverTimestamp(),
      atualizadoPor: uid,
    };
    // Campos de controle da tela nunca vão para o banco; `id` indefinido
    // derrubaria o lote inteiro (Firestore rejeita undefined)
    delete dados._alterado;
    delete dados._retrocessoDe;
    delete dados._novo;
    delete dados.id;
    if (item._novo || !item.id) {
      // Itens novos já chegam com id pré-gerado na tela (permite anexar
      // fotos antes de salvar); o fallback cobre itens sem id
      const ref = item.id ? doc(colecao, item.id) : doc(colecao);
      dados.criadoEm = serverTimestamp();
      lote.set(ref, dados);
      novos++;
      return { ...calculado, id: ref.id };
    }
    if (item._alterado) {
      lote.update(doc(colecao, item.id), dados);
      alterados++;
    }
    return calculado;
  });

  if (novos + alterados > 0) {
    await lote.commit();
    await recalcularOS(osId);
    registrarLog('itens_salvos', 'ordens_servico', osId, { novos, alterados }, uid);
  }
  return itensComId.map((item) => ({ ...item, _alterado: false }));
}

export async function excluirItem(osId, itemId, uid) {
  await deleteDoc(doc(db, 'ordens_servico', osId, 'itens', itemId));
  await recalcularOS(osId);
  registrarLog('item_excluido', 'ordens_servico', osId, { itemId }, uid);
}
