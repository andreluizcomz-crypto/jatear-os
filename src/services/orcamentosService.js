import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

// Criação com número ORC-AAAA-NNNN sequencial por transação no contador.
// Sem internet, a transação não funciona: o orçamento é gravado no cache
// local com número pendente e numerado depois por numerarPendentes().
export async function criarOrcamento(id, dados, uid) {
  const ano = new Date().getFullYear();
  const base = {
    ...dados,
    ano,
    criadoPor: uid,
    criadoEm: serverTimestamp(),
    atualizadoPor: uid,
    atualizadoEm: serverTimestamp(),
  };

  const gravarPendente = () => {
    // Sem await: com o cache offline, a gravação local é imediata e a
    // promessa só resolveria quando o servidor confirmasse
    setDoc(doc(db, 'orcamentos', id), { ...base, numero: '', numeroPendente: true }).catch(
      () => {}
    );
    return null;
  };

  if (!navigator.onLine) return gravarPendente();
  try {
    let numero = '';
    await runTransaction(db, async (transacao) => {
      const contadorRef = doc(db, 'contadores', `orc_${ano}`);
      const contador = await transacao.get(contadorRef);
      const sequencial = (contador.exists() ? contador.data().ultimoNumero : 0) + 1;
      numero = `ORC-${ano}-${String(sequencial).padStart(4, '0')}`;
      transacao.set(contadorRef, { prefixo: 'ORC', ano, ultimoNumero: sequencial });
      transacao.set(doc(db, 'orcamentos', id), { ...base, numero, numeroPendente: false });
    });
    registrarLog('orcamento_criado', 'orcamentos', id, { numero }, uid);
    return numero;
  } catch (excecao) {
    if (excecao?.code === 'unavailable' || excecao?.code === 'deadline-exceeded') {
      return gravarPendente();
    }
    throw excecao;
  }
}

export async function atualizarOrcamento(id, dados, uid) {
  const corpo = { ...dados, atualizadoPor: uid, atualizadoEm: serverTimestamp() };
  if (!navigator.onLine) {
    // Gravação local imediata; sincroniza sozinha quando a conexão voltar
    updateDoc(doc(db, 'orcamentos', id), corpo).catch(() => {});
  } else {
    await updateDoc(doc(db, 'orcamentos', id), corpo);
  }
  registrarLog('orcamento_atualizado', 'orcamentos', id, { numero: dados.numero || '' }, uid);
}

// Numera os orçamentos criados sem internet (chamado ao reconectar)
export async function numerarPendentes() {
  if (!navigator.onLine) return 0;
  const resultado = await getDocs(
    query(collection(db, 'orcamentos'), where('numeroPendente', '==', true))
  );
  let numerados = 0;
  for (const registro of resultado.docs) {
    const ano = new Date().getFullYear();
    try {
      await runTransaction(db, async (transacao) => {
        const contadorRef = doc(db, 'contadores', `orc_${ano}`);
        const contador = await transacao.get(contadorRef);
        const sequencial = (contador.exists() ? contador.data().ultimoNumero : 0) + 1;
        const numero = `ORC-${ano}-${String(sequencial).padStart(4, '0')}`;
        transacao.set(contadorRef, { prefixo: 'ORC', ano, ultimoNumero: sequencial });
        transacao.update(registro.ref, { numero, numeroPendente: false });
      });
      numerados++;
    } catch (_) {
      // tenta de novo na próxima sincronização
    }
  }
  return numerados;
}

// Upload de anexo (foto comprimida; vídeo, áudio e arquivo como estão).
// Retorna a tarefa (permite cancelar) e a promessa com os dados do anexo.
export async function iniciarEnvioAnexo(orcamentoId, tipo, arquivo, nome, aoProgredir, subpasta) {
  let conteudo = arquivo;
  let contentType = arquivo.type || 'application/octet-stream';
  if (tipo === 'foto') {
    conteudo = await comprimirImagem(arquivo);
    contentType = 'image/jpeg';
  }
  const pasta = subpasta ? `${orcamentoId}/${subpasta}` : orcamentoId;
  const caminho = `orcamentos/${pasta}/${Date.now()}_${nome.replace(/[^\w.\-]+/g, '_')}`;
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

// Envia os arquivos represados no aparelho (fila offline) e substitui os
// marcadores "pendente" nos orçamentos pelos anexos definitivos.
export async function processarFilaUploads() {
  if (!navigator.onLine) return 0;
  const { listarFila, removerDaFila, registrarResolvido } = await import(
    '../utils/filaUploads'
  );
  const fila = await listarFila();
  let enviados = 0;
  for (const entrada of fila) {
    try {
      const caminho = `orcamentos/${entrada.orcamentoId}/${entrada.itemId || 'geral'}/${Date.now()}_${entrada.nome.replace(/[^\w.\-]+/g, '_')}`;
      const tarefa = uploadBytesResumable(ref(storage, caminho), entrada.blob, {
        contentType: entrada.contentType || 'application/octet-stream',
      });
      await tarefa;
      const urlStorage = await getDownloadURL(tarefa.snapshot.ref);
      const anexo = {
        tipo: entrada.tipo,
        nome: entrada.nome,
        urlStorage,
        caminho,
        enviadoEm: new Date().toISOString(),
      };
      registrarResolvido(entrada.chave, anexo);

      // Troca o marcador pendente pelo anexo definitivo no documento
      const registro = await getDoc(doc(db, 'orcamentos', entrada.orcamentoId));
      if (registro.exists()) {
        const dados = registro.data();
        const trocar = (lista) =>
          (lista || []).map((a) => (a.chaveFila === entrada.chave ? anexo : a));
        await updateDoc(registro.ref, {
          anexos: trocar(dados.anexos),
          itens: (dados.itens || []).map((item) => ({ ...item, anexos: trocar(item.anexos) })),
        });
      }
      await removerDaFila(entrada.chave);
      enviados++;
    } catch (_) {
      // arquivo permanece na fila; tenta na próxima sincronização
    }
  }
  return enviados;
}
