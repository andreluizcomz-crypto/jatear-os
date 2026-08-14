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

export async function listarClientes() {
  const consulta = query(collection(db, 'clientes'), orderBy('razaoSocial'));
  const resultado = await getDocs(consulta);
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
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
