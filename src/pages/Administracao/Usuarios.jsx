import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  PERFIS,
  atualizarUsuario,
  criarUsuario,
  enviarRedefinicaoSenha,
  listarUsuarios,
} from '../../services/usuariosService';

const usuarioVazio = { nome: '', email: '', senha: '', perfil: 'consulta', ativo: true };

function traduzirErro(codigo) {
  switch (codigo) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail.';
    case 'auth/invalid-email':
      return 'O e-mail informado não é válido.';
    case 'auth/weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.';
    default:
      return 'Não foi possível salvar o usuário. Tente novamente.';
  }
}

export default function Usuarios() {
  const { usuario, ehAdministrador } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [emEdicao, setEmEdicao] = useState(null);
  const [ehNovo, setEhNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setUsuarios(await listarUsuarios());
  }

  useEffect(() => {
    if (!ehAdministrador) {
      setCarregando(false);
      return;
    }
    carregar()
      .catch(() => setErro('Não foi possível carregar os usuários.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdministrador]);

  async function aoSalvar(evento) {
    evento.preventDefault();
    setErro('');
    setAviso('');
    if (!emEdicao.nome.trim() || !emEdicao.email.trim()) {
      setErro('Preencha nome e e-mail.');
      return;
    }
    if (ehNovo && (emEdicao.senha || '').length < 6) {
      setErro('Defina uma senha temporária com pelo menos 6 caracteres.');
      return;
    }
    setSalvando(true);
    try {
      if (ehNovo) {
        await criarUsuario(
          {
            nome: emEdicao.nome.trim(),
            email: emEdicao.email.trim().toLowerCase(),
            senha: emEdicao.senha,
            perfil: emEdicao.perfil,
          },
          usuario.uid
        );
        setAviso('Usuário criado. Informe a senha temporária e oriente a troca no primeiro acesso.');
      } else {
        await atualizarUsuario(
          emEdicao.id,
          { nome: emEdicao.nome.trim(), perfil: emEdicao.perfil, ativo: emEdicao.ativo },
          usuario.uid
        );
        setAviso('Usuário atualizado.');
      }
      setEmEdicao(null);
      await carregar();
    } catch (excecao) {
      setErro(traduzirErro(excecao.code));
    } finally {
      setSalvando(false);
    }
  }

  async function redefinirSenha(email) {
    setErro('');
    try {
      await enviarRedefinicaoSenha(email);
      setAviso(`E-mail de redefinição de senha enviado para ${email}.`);
    } catch (_) {
      setErro('Não foi possível enviar o e-mail de redefinição.');
    }
  }

  if (!ehAdministrador) {
    return <div className="mensagem-erro">Acesso restrito ao administrador.</div>;
  }
  if (carregando) return <div className="texto-apoio">Carregando usuários...</div>;

  const rotuloPerfil = (valor) => PERFIS.find((p) => p.valor === valor)?.rotulo || valor;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Usuários e perfis</h1>
        <button
          type="button"
          className="botao-primario botao-acao"
          onClick={() => {
            setEhNovo(true);
            setEmEdicao({ ...usuarioVazio });
          }}
        >
          Novo usuário
        </button>
      </div>

      {erro && !emEdicao && <div className="mensagem-erro">{erro}</div>}
      {aviso && <div className="mensagem-sucesso">{aviso}</div>}

      <div className="lista-registros">
        {usuarios.map((registro) => (
          <div key={registro.id} className="linha-registro" style={{ display: 'block' }}>
            <div className="linha-principal">
              <strong>{registro.nome}</strong>
              <span className={registro.ativo ? 'badge badge-ativo' : 'badge badge-inativo'}>
                {registro.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="linha-detalhe">
              {registro.email} · Perfil: {rotuloPerfil(registro.perfil)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="botao-secundario"
                style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
                onClick={() => {
                  setEhNovo(false);
                  setEmEdicao({ ...registro });
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="botao-secundario"
                style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
                onClick={() => redefinirSenha(registro.email)}
              >
                Redefinir senha por e-mail
              </button>
            </div>
          </div>
        ))}
      </div>

      {emEdicao && (
        <div className="modal-fundo" onClick={() => !salvando && setEmEdicao(null)}>
          <form className="modal-conteudo" onClick={(e) => e.stopPropagation()} onSubmit={aoSalvar}>
            <h2 className="titulo-modal">{ehNovo ? 'Novo usuário' : `Editar ${emEdicao.nome}`}</h2>
            {erro && <div className="mensagem-erro">{erro}</div>}
            <div className="grade-formulario">
              <div className="campo">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  value={emEdicao.nome}
                  onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  value={emEdicao.email}
                  onChange={(e) => setEmEdicao({ ...emEdicao, email: e.target.value })}
                  disabled={!ehNovo}
                  required
                />
              </div>
              {ehNovo && (
                <div className="campo">
                  <label htmlFor="senha">Senha temporária</label>
                  <input
                    id="senha"
                    type="text"
                    value={emEdicao.senha}
                    onChange={(e) => setEmEdicao({ ...emEdicao, senha: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="campo">
                <label htmlFor="perfil">Perfil</label>
                <select
                  id="perfil"
                  value={emEdicao.perfil}
                  onChange={(e) => setEmEdicao({ ...emEdicao, perfil: e.target.value })}
                >
                  {PERFIS.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              {!ehNovo && (
                <div className="campo campo-caixa">
                  <label>
                    <input
                      type="checkbox"
                      checked={emEdicao.ativo}
                      onChange={(e) => setEmEdicao({ ...emEdicao, ativo: e.target.checked })}
                      disabled={emEdicao.id === usuario.uid}
                    />{' '}
                    Ativo
                  </label>
                </div>
              )}
            </div>
            <div className="acoes-modal">
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setEmEdicao(null)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button type="submit" className="botao-primario botao-acao" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
