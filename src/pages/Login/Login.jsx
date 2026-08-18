import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LogoJatear from '../../assets/LogoJatear';

function traduzirErro(codigo) {
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
    case 'auth/invalid-email':
      return 'O e-mail informado não é válido. Verifique a digitação.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
      return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
    default:
      return 'Não foi possível entrar. Tente novamente em instantes.';
  }
}

export default function Login() {
  const { usuario, carregando, entrar } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (carregando) {
    return <div className="tela-carregando">Carregando...</div>;
  }

  if (usuario) {
    return <Navigate to="/" replace />;
  }

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
      navegar('/', { replace: true });
    } catch (excecao) {
      setErro(traduzirErro(excecao.code));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tela-login">
      <header className="barra-superior">
        <LogoJatear altura={36} variante="branca" />
      </header>

      <form className="cartao-login" onSubmit={aoEnviar}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <LogoJatear variante="colorida" altura={64} />
        </div>
        <h1>Acessar o sistema</h1>
        <p className="subtitulo">Controle de Ordens de Serviço</p>

        {erro && <div className="mensagem-erro">{erro}</div>}

        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required
          />
        </div>

        <button type="submit" className="botao-primario" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
