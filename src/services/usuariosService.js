import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export async function buscarUsuario(uid) {
  const registro = await getDoc(doc(db, 'usuarios', uid));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}
