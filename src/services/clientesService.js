import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { somenteDigitos } from '../utils/validadores';

// Cópia local do cadastro (localStorage) para funcionar sem internet
const CHAVE_CACHE_CLIENTES = 'jatearos_clientes_cache';

function lerCacheClientes() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CACHE_CLIENTES) || '[]');
  } catch (_) {
    return [];
  }
}

function gravarCacheClientes(lista) {
  try {
    localStorage.setItem(
      CHAVE_CACHE_CLIENTES,
      JSON.stringify(
        lista.map((c) => ({
          id: c.id,
          razaoSocial: c.razaoSocial,
          nomeFantasia: c.nomeFantasia || '',
          cnpj: c.cnpj || '',
          ativo: c.ativo !== false,
          subclientes: c.subclientes || [],
          tabelaPrecos: c.tabelaPrecos || [],
          prazoPadraoDias: c.prazoPadraoDias || 0,
          endereco: c.endereco || {},
        }))
      )
    );
  } catch (_) {
    // sem espaço no aparelho: segue sem cópia local
  }
}

export async function listarClientes() {
  try {
    const consulta = query(collection(db, 'clientes'), orderBy('razaoSocial'));
    const resultado = await getDocs(consulta);
    const lista = resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (lista.length > 0) {
      gravarCacheClientes(lista);
      return lista;
    }
    // Cache do Firestore vazio (ex.: primeira abertura offline): usa a cópia local
    return lista.length === 0 && !navigator.onLine ? lerCacheClientes() : lista;
  } catch (excecao) {
    const copiaLocal = lerCacheClientes();
    if (copiaLocal.length > 0) return copiaLocal;
    throw excecao;
  }
}

export async function buscarCliente(id) {
  const registro = await getDoc(doc(db, 'clientes', id));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}

// Retorna o id do cliente que já usa o CNPJ, ou null
async function clienteComCnpj(cnpj) {
  const digitos = somenteDigitos(cnpj);
  if (!digitos) return null;
  const consulta = query(collection(db, 'clientes'), where('cnpj', '==', digitos));
  const resultado = await getDocs(consulta);
  return resultado.empty ? null : resultado.docs[0].id;
}

export async function criarCliente(dados, uid) {
  const existente = await clienteComCnpj(dados.cnpj);
  if (existente) throw new Error('cnpj-duplicado');
  const registro = await addDoc(collection(db, 'clientes'), {
    ...dados,
    cnpj: somenteDigitos(dados.cnpj),
    criadoEm: serverTimestamp(),
    criadoPor: uid,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  });
  return registro.id;
}

export async function atualizarCliente(id, dados, uid) {
  const existente = await clienteComCnpj(dados.cnpj);
  if (existente && existente !== id) throw new Error('cnpj-duplicado');
  await updateDoc(doc(db, 'clientes', id), {
    ...dados,
    cnpj: somenteDigitos(dados.cnpj),
    atualizadoEm: serverTimestamp(),
    atualizadoPor: uid,
  });
}
