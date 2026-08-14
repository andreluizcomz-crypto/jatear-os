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

export async function listarServicos() {
  const consulta = query(collection(db, 'servicos'), orderBy('ordem'));
  const resultado = await getDocs(consulta);
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
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
