import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { STATUS_ORCAMENTO, listarOrcamentos } from '../../services/orcamentosService';
import { formatarData, formatarMoeda } from '../../utils/formatadores';

const FILTROS = [
  { chave: 'todos', rotulo: 'Todos', status: null },
  { chave: 'aberto', rotulo: 'Em elaboração', status: ['aberto'] },
  { chave: 'enviado', rotulo: 'Enviados', status: ['enviado'] },
  { chave: 'aprovado', rotulo: 'Aprovados', status: ['aprovado'] },
  { chave: 'perdido', rotulo: 'Não fechados', status: ['perdido'] },
];

export default function Orcamentos() {
  const navegar = useNavigate();
  const { ehAdministrador, podeVerValores, perfilUsuario } = useAuth();
  const podeEditar = ehAdministrador || perfilUsuario?.perfil === 'producao';
  const [orcamentos, setOrcamentos] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarOrcamentos()
      .then(setOrcamentos)
      .catch(() => setErro('Não foi possível carregar os orçamentos.'))
      .finally(() => setCarregando(false));
  }, []);

  const termo = busca.trim().toLowerCase();
  const statusFiltro = FILTROS.find((f) => f.chave === filtro)?.status;
  const filtrados = orcamentos.filter((orc) => {
    if (statusFiltro && !statusFiltro.includes(orc.status)) return false;
    if (!termo) return true;
    return (
      (orc.numero || '').toLowerCase().includes(termo) ||
      (orc.clienteNome || '').toLowerCase().includes(termo) ||
      (orc.localObra || '').toLowerCase().includes(termo) ||
      (orc.descricao || '').toLowerCase().includes(termo)
    );
  });

  if (carregando) return <div className="texto-apoio">Carregando orçamentos...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Orçamentos</h1>
        {podeEditar && (
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={() => navegar('/orcamentos/novo')}
          >
            Novo orçamento
          </button>
        )}
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="filtros-rapidos">
        {FILTROS.map(({ chave, rotulo, status }) => (
          <button
            type="button"
            key={chave}
            className={filtro === chave ? 'ativo' : ''}
            onClick={() => setFiltro(chave)}
          >
            {rotulo} (
            {status ? orcamentos.filter((o) => status.includes(o.status)).length : orcamentos.length}
            )
          </button>
        ))}
      </div>

      <div className="campo" style={{ maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Buscar por número, cliente, obra ou descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar orçamento"
        />
      </div>

      <div className="lista-registros">
        {filtrados.map((orc) => {
          const anexos = [
            ...(orc.anexos || []),
            ...(orc.itens || []).flatMap((item) => item.anexos || []),
          ];
          const contar = (tipo) => anexos.filter((a) => a.tipo === tipo).length;
          return (
            <button
              type="button"
              key={orc.id}
              className="linha-registro"
              onClick={() => navegar(`/orcamentos/${orc.id}`)}
            >
              <div className="linha-principal">
                <strong>
                  {orc.numero || 'Aguardando número'} — {orc.clienteNome}
                </strong>
                <span
                  className="badge"
                  style={{
                    background: 'var(--cinza-claro)',
                    color: STATUS_ORCAMENTO[orc.status]?.cor || '#555555',
                  }}
                >
                  {STATUS_ORCAMENTO[orc.status]?.rotulo || orc.status}
                </span>
              </div>
              <div className="linha-detalhe">
                {formatarData(orc.criadoEm)}
                {orc.localObra && ` · ${orc.localObra}`}
                {(orc.itens || []).length > 0 && ` · ${orc.itens.length} item(ns)`}
                {podeVerValores &&
                  Number(orc.valorEstimado) > 0 &&
                  ` · ${formatarMoeda(orc.valorEstimado)}`}
                {contar('foto') > 0 && ` · ${contar('foto')} foto(s)`}
                {contar('audio') > 0 && ` · ${contar('audio')} áudio(s)`}
                {contar('video') > 0 && ` · ${contar('video')} vídeo(s)`}
                {contar('arquivo') > 0 && ` · ${contar('arquivo')} arquivo(s)`}
              </div>
            </button>
          );
        })}
        {filtrados.length === 0 && (
          <p className="texto-apoio">
            {orcamentos.length === 0
              ? 'Nenhum orçamento ainda. Use "Novo orçamento" para registrar uma visita de campo.'
              : 'Nenhum orçamento encontrado para este filtro.'}
          </p>
        )}
      </div>
    </div>
  );
}
