import { collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Consulta global de itens de todas as OS (collectionGroup).
// A filtragem fina é feita em memória — volume interno pequeno.
export async function listarTodosItens() {
  const resultado = await getDocs(collectionGroup(db, 'itens'));
  return resultado.docs.map((d) => ({
    id: d.id,
    osId: d.ref.parent.parent.id,
    ...d.data(),
  }));
}
