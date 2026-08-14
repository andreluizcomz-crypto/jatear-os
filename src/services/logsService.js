import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Registro de auditoria. Nunca bloqueia a operação principal.
export function registrarLog(acao, entidade, entidadeId, dados, usuarioId) {
  return addDoc(collection(db, 'logs'), {
    acao,
    entidade,
    entidadeId: entidadeId || null,
    dados: dados || null,
    usuarioId: usuarioId || null,
    dataHora: serverTimestamp(),
  }).catch(() => {});
}
