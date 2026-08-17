import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { IconeItens, IconeOS, IconeSair } from '../../components/Icones';
import { alterarMinhaSenha } from '../../services/usuariosService';

export default function Menu() {
  const { usuario, perfilUsuario, sair } = useAuth();
  const [modalSenha, setModalSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function trocarSenha(evento) {
    evento.preventDefault();
    setErro('');
    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro('As duas senhas não conferem.');
      return;
    }
    setSalvando(true);
    try {
      await alterarMinhaSenha(novaSenha);
      setModalSenha(false);
      setNovaSenha('');
      setConfirmacao('');
      setAviso('Senha alterada com sucesso.');
    } catch (excecao) {
      setErro(
        excecao.code === 'auth/requires-recent-login'
          ? 'Por segurança, saia do sistema, entre de novo e tente trocar a senha em seguida.'
          : 'Não foi possível alterar a senha. Tente novamente.'
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <h1 className="titulo-pagina">Menu</h1>

      {aviso && <div className="mensagem-sucesso">{aviso}</div>}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <p className="texto-apoio">Conectado como:</p>
        <p style={{ fontWeight: 'bold', marginTop: 4 }}>{usuario?.email}</p>
        {perfilUsuario && (
          <p className="texto-apoio" style={{ marginTop: 4 }}>
            Perfil: {perfilUsuario.perfil}
          </p>
        )}
      </div>

      <h2 className="texto-apoio" style={{ fontWeight: 'bold', marginBottom: 8 }}>
        Cadastros
      </h2>
      <div className="lista-menu" style={{ marginBottom: 16 }}>
        <Link to="/clientes">
          <IconeOS width={20} height={20} />
          Clientes
        </Link>
        <Link to="/servicos">
          <IconeItens width={20} height={20} />
          Serviços
        </Link>
      </div>

      {perfilUsuario?.perfil === 'administrador' && (
        <>
          <h2 className="texto-apoio" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Administração
          </h2>
          <div className="lista-menu" style={{ marginBottom: 16 }}>
            <Link to="/usuarios">
              <IconeItens width={20} height={20} />
              Usuários e perfis
            </Link>
            <Link to="/logs">
              <IconeOS width={20} height={20} />
              Logs de auditoria
            </Link>
          </div>
        </>
      )}

      <div className="cartao">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="botao-secundario"
            onClick={() => setModalSenha(true)}
          >
            Alterar minha senha
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={sair}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <IconeSair width={18} height={18} />
            Sair do sistema
          </button>
        </div>
      </div>

      {modalSenha && (
        <div className="modal-fundo" onClick={() => setModalSenha(false)}>
          <form className="modal-conteudo" onClick={(e) => e.stopPropagation()} onSubmit={trocarSenha}>
            <h2 className="titulo-modal">Alterar minha senha</h2>
            {erro && <div className="mensagem-erro">{erro}</div>}
            <div className="campo">
              <label htmlFor="novaSenha">Nova senha</label>
              <input
                id="novaSenha"
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
            </div>
            <div className="campo">
              <label htmlFor="confirmacao">Repita a nova senha</label>
              <input
                id="confirmacao"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
              />
            </div>
            <div className="acoes-modal">
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setModalSenha(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className="botao-primario botao-acao" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
