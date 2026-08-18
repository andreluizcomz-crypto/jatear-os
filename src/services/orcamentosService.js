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
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { registrarLog } from './logsService';
import { comprimirImagem } from '../utils/imagem';

export const STATUS_ORCAMENTO = {
  aberto: { rotulo: 'Em elaboração', cor: '#0277BD' },
  enviado: { rotulo: 'Enviado ao cliente', cor: '#ED6C02' },
  aprovado: { rotulo: 'Aprovado', cor: '#2E7D32' },
  perdido: { rotulo: 'Não fechado', cor: '#C62828' },
};

export function novoIdOrcamento() {
  return doc(collection(db, 'orcamentos')).id;
}

export async function listarOrcamentos() {
  const resultado = await getDocs(
    query(collection(db, 'orcamentos'), orderBy('numero', 'desc'))
  );
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function buscarOrcamento(id) {
  const registro = await getDoc(doc(db, 'orcamentos', id));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}

// Criação com número ORC-AAAA-NNNN sequencial por transação no contador
export async function criarOrcamento(id, dados, uid) {
  const ano = new Date().getFullYear();
  let numero = '';
  await runTransaction(db, async (transacao) => {
    const contadorRef = doc(db, 'contadores', `orc_${ano}`);
    const contador = await transacao.get(contadorRef);
    const sequencial = (contador.exists() ? contador.data().ultimoNumero : 0) + 1;
    numero = `ORC-${ano}-${String(sequencial).padStart(4, '0')}`;
    transacao.set(contadorRef, { prefixo: 'ORC', ano, ultimoNumero: sequencial });
    transacao.set(doc(db, 'orcamentos', id), {
      ...dados,
      numero,
      ano,
      criadoPor: uid,
      criadoEm: serverTimestamp(),
      atualizadoPor: uid,
      atualizadoEm: serverTimestamp(),
    });
  });
  registrarLog('orcamento_criado', 'orcamentos', id, { numero }, uid);
  return numero;
}

export async function atualizarOrcamento(id, dados, uid) {
  await updateDoc(doc(db, 'orcamentos', id), {
    ...dados,
    atualizadoPor: uid,
    atualizadoEm: serverTimestamp(),
  });
  registrarLog('orcamento_atualizado', 'orcamentos', id, { numero: dados.numero }, uid);
}

// Upload de anexo (foto comprimida; vídeo, áudio e arquivo como estão).
// Retorna a tarefa (permite cancelar) e a promessa com os dados do anexo.
export async function iniciarEnvioAnexo(orcamentoId, tipo, arquivo, nome, aoProgredir) {
  let conteudo = arquivo;
  let contentType = arquivo.type || 'application/octet-stream';
  if (tipo === 'foto') {
    conteudo = await comprimirImagem(arquivo);
    contentType = 'image/jpeg';
  }
  const caminho = `orcamentos/${orcamentoId}/${Date.now()}_${nome.replace(/[^\w.\-]+/g, '_')}`;
  const tarefa = uploadBytesResumable(ref(storage, caminho), conteudo, { contentType });

  const promessa = new Promise((resolver, rejeitar) => {
    tarefa.on(
      'state_changed',
      (situacao) =>
        aoProgredir(Math.round((situacao.bytesTransferred / situacao.totalBytes) * 100)),
      rejeitar,
      async () => {
        const urlStorage = await getDownloadURL(tarefa.snapshot.ref);
        resolver({ tipo, nome, urlStorage, caminho, enviadoEm: new Date().toISOString() });
      }
    );
  });
  return { tarefa, promessa };
}

export function excluirAnexo(caminho) {
  return deleteObject(ref(storage, caminho)).catch(() => {});
}
