import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { registrarLog } from './logsService';

export const PERFIS = [
  { valor: 'administrador', rotulo: 'Administrador' },
  { valor: 'producao', rotulo: 'Produção' },
  { valor: 'faturamento', rotulo: 'Faturamento' },
  { valor: 'consulta', rotulo: 'Consulta' },
];

export async function buscarUsuario(uid) {
  const registro = await getDoc(doc(db, 'usuarios', uid));
  return registro.exists() ? { id: registro.id, ...registro.data() } : null;
}

export async function listarUsuarios() {
  const resultado = await getDocs(query(collection(db, 'usuarios'), orderBy('nome')));
  return resultado.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Cria a conta no Auth por um app secundário para não derrubar a
// sessão do administrador conectado.
export async function criarUsuario({ nome, email, senha, perfil }, adminUid) {
  const nomeApp = 'criacao-usuario';
  const appSecundario =
    getApps().find((a) => a.name === nomeApp) || initializeApp(getApp().options, nomeApp);
  const authSecundario = getAuth(appSecundario);
  const credencial = await createUserWithEmailAndPassword(authSecundario, email, senha);
  const uid = credencial.user.uid;
  await signOut(authSecundario);

  await setDoc(doc(db, 'usuarios', uid), {
    nome,
    email,
    perfil,
    ativo: true,
    criadoEm: serverTimestamp(),
    criadoPor: adminUid,
  });
  registrarLog('usuario_criado', 'usuarios', uid, { email, perfil }, adminUid);
  return uid;
}

export async function atualizarUsuario(uid, dados, adminUid) {
  await updateDoc(doc(db, 'usuarios', uid), {
    ...dados,
    atualizadoEm: serverTimestamp(),
    atualizadoPor: adminUid,
  });
  registrarLog('usuario_atualizado', 'usuarios', uid, dados, adminUid);
}

export function enviarRedefinicaoSenha(email) {
  return sendPasswordResetEmail(auth, email);
}

export function alterarMinhaSenha(novaSenha) {
  return updatePassword(auth.currentUser, novaSenha);
}
