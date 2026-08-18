import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// Cópia local do catálogo (localStorage) para funcionar sem internet
const CHAVE_CACHE_SERVICOS = 'jatearos_servicos_cache';

export async function listarServicos() {
  try {
    const consulta = query(collection(db, 'servicos'), orderBy('ordem'));
    const resultado = await getDocs(consulta);
    const lista = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (lista.length > 0) {
      try {
        localStorage.setItem(CHAVE_CACHE_SERVICOS, JSON.stringify(lista));
      } catch (_) {}
      return lista;
    }
    if (!navigator.onLine) {
      return JSON.parse(localStorage.getItem(CHAVE_CACHE_SERVICOS) || '[]');
    }
    return lista;
  } catch (excecao) {
    const copiaLocal = JSON.parse(localStorage.getItem(CHAVE_CACHE_SERVICOS) || '[]');
    if (copiaLocal.length > 0) return copiaLocal;
    throw excecao;
  }
}

// O ID do documento é o próprio código — garante unicidade do código.
export async function salvarServico(servico) {
  const codigo = (servico.codigo || '').trim().toUpperCase();
  await setDoc(
    doc(db, 'servicos', codigo),
    { ...servico, codigo, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
  return codigo;
}
