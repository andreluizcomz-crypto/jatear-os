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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { registrarLog } from './logsService';
import { recalcularOS } from './osService';
import { inputParaTimestamp, somarDias } from '../utils/datas';

export async function listarFaturamentos() {
  const resultado = await getDocs(
    query(collection(db, 'faturamentos'), orderBy('numero', 'desc'))
  );
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function buscarFaturamento(id) {
  const registro = await getDoc(doc(db, 'faturamentos', id));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}

// Geração transacional (regra 7.6): valida, congela valores, numera pelo
// contador fat_{ano} e marca os itens — tudo ou nada.
export async function gerarFaturamento(chaves, dados, uid) {
  const ano = new Date().getFullYear();
  const fatRef = doc(collection(db, 'faturamentos'));
  let numero = '';

  await runTransaction(db, async (transacao) => {
    const contadorRef = doc(db, 'contadores', `fat_${ano}`);
    const contador = await transacao.get(contadorRef);
    const sequencial = (contador.exists() ? contador.data().ultimoNumero : 0) + 1;
    numero = `FAT-${ano}-${String(sequencial).padStart(4, '0')}`;

    // Todas as leituras antes de qualquer escrita
    const lidos = [];
    for (const { osId, itemId } of chaves) {
      const ref = doc(db, 'ordens_servico', osId, 'itens', itemId);
      const registro = await transacao.get(ref);
      if (!registro.exists()) throw new Error('item-inexistente');
      const item = registro.data();
      if (item.faturado === true) throw new Error('item-ja-faturado');
      if (!['concluido', 'entregue'].includes(item.status)) throw new Error('item-nao-concluido');
      const servicos = item.servicos || [];
      if (servicos.length === 0 || servicos.some((s) => !(Number(s.precoUnitario) > 0))) {
        throw new Error('item-sem-preco');
      }
      lidos.push({ ref, osId, itemId, item });
    }
    if (new Set(lidos.map((x) => x.item.clienteId)).size !== 1) {
      throw new Error('clientes-diferentes');
    }

    // Cópia congelada dos valores (alteração futura não muda o faturamento)
    const congelados = lidos.map(({ item, osId, itemId }) => ({
      osId,
      osNumero: item.osNumero,
      itemId,
      sequencia: item.sequencia,
      descricao: item.descricao,
      subclienteNome: item.subclienteNome || '',
      quantidade: item.quantidade || 0,
      pesoTotalKg: item.pesoTotalKg || 0,
      areaTotalM2: item.areaTotalM2 || 0,
      servicos: (item.servicos || []).map((s) => ({
        codigo: s.servicoCodigo,
        unidade: s.unidade,
        quantidadeCobrada: s.quantidadeCobrada || 0,
        precoUnitario: s.precoUnitario || 0,
        valor: s.valor || 0,
      })),
      valorTotalItem: item.valorTotalItem || 0,
    }));
    const soma = (fn) =>
      Number(congelados.reduce((total, i) => total + (fn(i) || 0), 0).toFixed(2));

    transacao.set(contadorRef, { prefixo: 'FAT', ano, ultimoNumero: sequencial });
    transacao.set(fatRef, {
      numero,
      clienteId: lidos[0].item.clienteId,
      clienteNome: lidos[0].item.clienteNome,
      subclienteNome: dados.subclienteNome || '',
      periodoInicio: dados.periodoInicio || null,
      periodoFim: dados.periodoFim || null,
      criterioData: dados.criterioData || 'conclusao',
      itens: congelados,
      qtdItens: congelados.length,
      pesoTotalKg: soma((i) => i.pesoTotalKg),
      areaTotalM2: soma((i) => i.areaTotalM2),
      valorTotal: soma((i) => i.valorTotalItem),
      status: 'emitido',
      notaFiscal: '',
      dataNotaFiscal: null,
      formaPagamento: dados.formaPagamento || '',
      prazoPagamentoDias: Number(dados.prazoPagamentoDias) || 0,
      dataPrevistaRecebimento: null, // definida ao registrar a NF
      statusPagamento: 'aguardando',
      dataRecebimento: null,
      observacoes: dados.observacoes || '',
      geradoPor: uid,
      geradoEm: serverTimestamp(),
      canceladoPor: null,
      canceladoEm: null,
      motivoCancelamento: '',
    });
    lidos.forEach(({ ref }) =>
      transacao.update(ref, {
        faturado: true,
        faturamentoId: fatRef.id,
        faturamentoNumero: numero,
        status: 'faturado',
        dataFaturamento: serverTimestamp(),
      })
    );
  });

  for (const osId of [...new Set(chaves.map((c) => c.osId))]) {
    await recalcularOS(osId);
  }
  registrarLog(
    'faturamento_gerado',
    'faturamentos',
    fatRef.id,
    { numero, qtdItens: chaves.length },
    uid
  );
  return fatRef.id;
}

// Cancelamento (regra 7.7): devolve itens para concluido; o faturamento
// permanece com status cancelado, nunca é excluído.
export async function cancelarFaturamento(faturamentoId, motivo, uid) {
  const faturamento = await buscarFaturamento(faturamentoId);
  if (!faturamento || faturamento.status !== 'emitido') throw new Error('faturamento-invalido');

  const lote = writeBatch(db);
  lote.update(doc(db, 'faturamentos', faturamentoId), {
    status: 'cancelado',
    motivoCancelamento: motivo,
    canceladoPor: uid,
    canceladoEm: serverTimestamp(),
  });
  faturamento.itens.forEach((item) =>
    lote.update(doc(db, 'ordens_servico', item.osId, 'itens', item.itemId), {
      status: 'concluido',
      faturado: false,
      faturamentoId: null,
      faturamentoNumero: null,
      dataFaturamento: null,
      notaFiscal: '',
    })
  );
  await lote.commit();

  for (const osId of [...new Set(faturamento.itens.map((i) => i.osId))]) {
    await recalcularOS(osId);
  }
  registrarLog(
    'faturamento_cancelado',
    'faturamentos',
    faturamentoId,
    { numero: faturamento.numero, motivo },
    uid
  );
}

// Registro manual do número da NF (o sistema não emite nota).
// dataNotaInput no formato AAAA-MM-DD; o vencimento é calculado
// somando o prazo de pagamento à data da NF.
export async function registrarNotaFiscal(faturamentoId, notaFiscal, dataNotaInput, uid) {
  const faturamento = await buscarFaturamento(faturamentoId);
  if (!faturamento) throw new Error('faturamento-invalido');
  // Faturamento cancelado não recebe NF — os itens já pertencem a outro fluxo
  if (faturamento.status !== 'emitido') throw new Error('faturamento-cancelado');

  const prazo = Number(faturamento.prazoPagamentoDias) || 0;
  const dataPrevistaRecebimento =
    dataNotaInput && prazo > 0
      ? inputParaTimestamp(somarDias(dataNotaInput, prazo))
      : null;

  const lote = writeBatch(db);
  lote.update(doc(db, 'faturamentos', faturamentoId), {
    notaFiscal,
    dataNotaFiscal: inputParaTimestamp(dataNotaInput),
    dataPrevistaRecebimento,
  });
  faturamento.itens.forEach((item) =>
    lote.update(doc(db, 'ordens_servico', item.osId, 'itens', item.itemId), { notaFiscal })
  );
  await lote.commit();
  registrarLog('nf_registrada', 'faturamentos', faturamentoId, { notaFiscal }, uid);
}

// Confirmação de recebimento do pagamento (data no formato AAAA-MM-DD)
export async function confirmarRecebimento(faturamentoId, dataRecebimentoInput, uid) {
  const faturamento = await buscarFaturamento(faturamentoId);
  if (!faturamento || faturamento.status !== 'emitido') throw new Error('faturamento-invalido');
  await updateDoc(doc(db, 'faturamentos', faturamentoId), {
    statusPagamento: 'recebido',
    dataRecebimento: inputParaTimestamp(dataRecebimentoInput),
  });
  registrarLog(
    'recebimento_confirmado',
    'faturamentos',
    faturamentoId,
    { numero: faturamento.numero, data: dataRecebimentoInput },
    uid
  );
}
