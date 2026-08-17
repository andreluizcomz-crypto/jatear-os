import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { buscarUsuario } from '../services/usuariosService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [perfilUsuario, setPerfilUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const cancelarObservador = onAuthStateChanged(auth, async (usuarioAtual) => {
      setUsuario(usuarioAtual);
      if (usuarioAtual) {
        try {
          setPerfilUsuario(await buscarUsuario(usuarioAtual.uid));
        } catch (_) {
          setPerfilUsuario(null);
        }
      } else {
        setPerfilUsuario(null);
      }
      setCarregando(false);
    });
    return cancelarObservador;
  }, []);

  function entrar(email, senha) {
    return signInWithEmailAndPassword(auth, email, senha);
  }

  function sair() {
    return signOut(auth);
  }

  const ehAdministrador = perfilUsuario?.perfil === 'administrador';
  // Produção e Consulta não veem valores financeiros (especificação seção 11)
  const podeVerValores = ['administrador', 'faturamento'].includes(perfilUsuario?.perfil);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        perfilUsuario,
        ehAdministrador,
        podeVerValores,
        carregando,
        entrar,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
