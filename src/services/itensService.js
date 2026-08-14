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

// Recalcula os campos derivados de um item (pesos, áreas e valores)
export function calcularItem(item) {
  const quantidade = Number(item.quantidade) || 0;
  const pesoUnitarioKg = Number(item.pesoUnitarioKg) || 0;
  const areaUnitariaM2 = Number(item.areaUnitariaM2) || 0;
  const pesoTotalKg = Number((quantidade * pesoUnitarioKg).toFixed(2));
  const areaTotalM2 = Number((quantidade * areaUnitariaM2).toFixed(2));

  const servicos = (item.servicos || []).map((servico) => {
    const quantidadeCobrada = Number(servico.quantidadeCobrada) || 0;
    const precoUnitario = Number(servico.precoUnitario) || 0;
    return {
      ...servico,
      quantidadeCobrada,
      precoUnitario,
      valor: Number((quantidadeCobrada * precoUnitario).toFixed(2)),
    };
  });

  return {
    ...item,
    quantidade,
    pesoUnitarioKg,
    areaUnitariaM2,
    pesoTotalKg,
    areaTotalM2,
    servicos,
    valorTotalItem: Number(servicos.reduce((total, s) => total + s.valor, 0).toFixed(2)),
  };
}

// Sugestão de quantidade cobrada conforme a unidade (especificação 4.4)
export function sugerirQuantidadeCobrada(unidade, item) {
  const calculado = calcularItem(item);
  if (unidade === 'm2') return calculado.areaTotalM2;
  if (unidade === 'kg') return calculado.pesoTotalKg;
  if (unidade === 'peca') return calculado.quantidade;
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
    const calculado = calcularItem(item);
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
    delete dados._alterado;
    if (!item.id) {
      const ref = doc(colecao);
      dados.criadoEm = serverTimestamp();
      lote.set(ref, dados);
      novos++;
      return { ...calculado, id: ref.id };
    }
    if (item._alterado) {
      const { id, ...semId } = dados;
      lote.update(doc(colecao, item.id), semId);
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
