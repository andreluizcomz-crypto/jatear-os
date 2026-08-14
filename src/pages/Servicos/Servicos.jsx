import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { listarServicos, salvarServico } from '../../services/servicosService';
import { formatarMoeda, rotuloUnidade, UNIDADES } from '../../utils/formatadores';

const GRAUS_LIMPEZA = ['Sa1', 'Sa2', 'Sa2.5', 'Sa3', 'ST2', 'ST3'];

const servicoVazio = {
  codigo: '',
  nome: '',
  descricao: '',
  unidadePadrao: 'm2',
  precoPadrao: 0,
  demaos: 0,
  grauLimpezaPadrao: null,
  ativo: true,
  ordem: 0,
};

export default function Servicos() {
  const { ehAdministrador } = useAuth();
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [emEdicao, setEmEdicao] = useState(null); // null = modal fechado
  const [ehNovo, setEhNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      setServicos(await listarServicos());
      setErro('');
    } catch (_) {
      setErro('Não foi possível carregar os serviços. Recarregue a página.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setEhNovo(true);
    setEmEdicao({ ...servicoVazio, ordem: servicos.length + 1 });
  }

  function abrirEdicao(servico) {
    setEhNovo(false);
    setEmEdicao({ ...servico });
  }

  async function aoSalvar(evento) {
    evento.preventDefault();
    if (!emEdicao.codigo.trim() || !emEdicao.nome.trim()) {
      setErro('Preencha o código e o nome do serviço.');
      return;
    }
    if (ehNovo && servicos.some((s) => s.codigo === emEdicao.codigo.trim().toUpperCase())) {
      setErro('Já existe um serviço com este código. Use outro código.');
      return;
    }
    setSalvando(true);
    try {
      await salvarServico({
        ...emEdicao,
        precoPadrao: Number(emEdicao.precoPadrao) || 0,
        demaos: Number(emEdicao.demaos) || 0,
        ordem: Number(emEdicao.ordem) || 0,
      });
      setEmEdicao(null);
      setErro('');
      await carregar();
    } catch (_) {
      setErro('Não foi possível salvar. Verifique sua permissão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando serviços...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Serviços</h1>
        {ehAdministrador && (
          <button type="button" className="botao-primario botao-acao" onClick={abrirNovo}>
            Novo serviço
          </button>
        )}
      </div>

      {erro && !emEdicao && <div className="mensagem-erro">{erro}</div>}

      <div className="lista-registros">
        {servicos.map((servico) => (
          <button
            type="button"
            key={servico.id}
            className="linha-registro"
            onClick={() => ehAdministrador && abrirEdicao(servico)}
          >
            <div className="linha-principal">
              <strong>
                {servico.codigo} — {servico.nome}
              </strong>
              <span className={servico.ativo ? 'badge badge-ativo' : 'badge badge-inativo'}>
                {servico.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="linha-detalhe">
              Unidade: {rotuloUnidade(servico.unidadePadrao)} · Preço padrão:{' '}
              {formatarMoeda(servico.precoPadrao)}
              {servico.demaos > 0 && ` · ${servico.demaos} demão${servico.demaos > 1 ? 's' : ''}`}
              {servico.grauLimpezaPadrao && ` · Grau: ${servico.grauLimpezaPadrao}`}
            </div>
          </button>
        ))}
        {servicos.length === 0 && (
          <p className="texto-apoio">Nenhum serviço cadastrado.</p>
        )}
      </div>

      {emEdicao && (
        <div className="modal-fundo" onClick={() => !salvando && setEmEdicao(null)}>
          <form
            className="modal-conteudo"
            onClick={(e) => e.stopPropagation()}
            onSubmit={aoSalvar}
          >
            <h2 className="titulo-modal">{ehNovo ? 'Novo serviço' : 'Editar serviço'}</h2>

            {erro && <div className="mensagem-erro">{erro}</div>}

            <div className="grade-formulario">
              <div className="campo">
                <label htmlFor="codigo">Código</label>
                <input
                  id="codigo"
                  value={emEdicao.codigo}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, codigo: e.target.value.toUpperCase() })
                  }
                  disabled={!ehNovo}
                  maxLength={6}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="nome">Nome</label>
                <input
                  id="nome"
                  value={emEdicao.nome}
                  onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                  required
                />
              </div>
              <div className="campo campo-largo">
                <label htmlFor="descricao">Descrição</label>
                <input
                  id="descricao"
                  value={emEdicao.descricao || ''}
                  onChange={(e) => setEmEdicao({ ...emEdicao, descricao: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="unidade">Unidade padrão</label>
                <select
                  id="unidade"
                  value={emEdicao.unidadePadrao}
                  onChange={(e) => setEmEdicao({ ...emEdicao, unidadePadrao: e.target.value })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u.valor} value={u.valor}>
                      {u.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="preco">Preço padrão (R$)</label>
                <input
                  id="preco"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={emEdicao.precoPadrao}
                  onChange={(e) => setEmEdicao({ ...emEdicao, precoPadrao: e.target.value })}
                />
              </div>
              <div className="campo">
                <label htmlFor="demaos">Demãos</label>
                <select
                  id="demaos"
                  value={emEdicao.demaos}
                  onChange={(e) => setEmEdicao({ ...emEdicao, demaos: e.target.value })}
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="grau">Grau de limpeza padrão</label>
                <select
                  id="grau"
                  value={emEdicao.grauLimpezaPadrao || ''}
                  onChange={(e) =>
                    setEmEdicao({ ...emEdicao, grauLimpezaPadrao: e.target.value || null })
                  }
                >
                  <option value="">Nenhum</option>
                  {GRAUS_LIMPEZA.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="ordem">Ordem de exibição</label>
                <input
                  id="ordem"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={emEdicao.ordem}
                  onChange={(e) => setEmEdicao({ ...emEdicao, ordem: e.target.value })}
                />
              </div>
              <div className="campo campo-caixa">
                <label>
                  <input
                    type="checkbox"
                    checked={emEdicao.ativo}
                    onChange={(e) => setEmEdicao({ ...emEdicao, ativo: e.target.checked })}
                  />{' '}
                  Ativo
                </label>
              </div>
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
