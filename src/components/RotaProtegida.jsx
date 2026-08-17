import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RotaProtegida({ children }) {
  const { usuario, perfilUsuario, carregando, sair } = useAuth();

  if (carregando) {
    return <div className="tela-carregando">Carregando...</div>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Conta sem perfil liberado ou inativada: sem acesso e com explicação
  // (as regras do servidor já bloqueiam toda leitura nesse caso)
  if (!perfilUsuario || perfilUsuario.ativo === false) {
    return (
      <div className="tela-carregando" style={{ flexDirection: 'column', gap: 16, padding: 24 }}>
        <p style={{ textAlign: 'center', maxWidth: 420, lineHeight: 1.5 }}>
          {perfilUsuario
            ? 'Sua conta foi inativada. Procure o administrador do sistema para reativá-la.'
            : 'Sua conta ainda não foi liberada. Peça ao administrador para cadastrar seu perfil de acesso.'}
        </p>
        <button type="button" className="botao-secundario" onClick={sair}>
          Sair
        </button>
      </div>
    );
  }

  return children;
}
