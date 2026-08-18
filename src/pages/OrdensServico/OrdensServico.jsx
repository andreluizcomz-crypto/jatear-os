import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarOS } from '../../services/osService';
import { formatarData, formatarMoeda } from '../../utils/formatadores';
import { STATUS_OS, rotuloStatusOS } from '../../utils/constantes';

// Filtros rápidos da lista de OS
const FILTROS_OS = [
  { chave: 'todas', rotulo: 'Todas', status: null },
  { chave: 'abertas', rotulo: 'Abertas', status: ['aberta', 'em_execucao'] },
  { chave: 'concluidas', rotulo: 'Concluídas', status: ['concluida'] },
  { chave: 'faturadas', rotulo: 'Faturadas', status: ['parcialmente_faturada', 'faturada'] },
  { chave: 'canceladas', rotulo: 'Canceladas', status: ['cancelada'] },
];

export default function OrdensServico() {
  const navegar = useNavigate();
  const { ehAdministrador, podeVerValores, perfilUsuario } = useAuth();
  const podeEditar = ehAdministrador || perfilUsuario?.perfil === 'producao';
  const [ordens, setOrdens] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarOS()
      .then(setOrdens)
      .catch(() => setErro('Não foi possível carregar as ordens de serviço.'))
      .finally(() => setCarregando(false));
  }, []);

  const contagem = (chave) => {
    const definicao = FILTROS_OS.find((f) => f.chave === chave);
    if (!definicao.status) return ordens.length;
    return ordens.filter((os) => definicao.status.includes(os.status)).length;
  };

  const termo = busca.trim().toLowerCase();
  const statusFiltro = FILTROS_OS.find((f) => f.chave === filtro)?.status;
  const filtradas = ordens.filter((os) => {
    if (statusFiltro && !statusFiltro.includes(os.status)) return false;
    if (!termo) return true;
    return (
      (os.numero || '').toLowerCase().includes(termo) ||
      (os.clienteNome || '').toLowerCase().includes(termo) ||
      (os.subclienteNome || '').toLowerCase().includes(termo)
    );
  });

  if (carregando) return <div className="texto-apoio">Carregando ordens de serviço...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Ordens de Serviço</h1>
        {podeEditar && (
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={() => navegar('/ordens/nova')}
          >
            Nova OS
          </button>
        )}
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="filtros-rapidos">
        {FILTROS_OS.map(({ chave, rotulo }) => (
          <button
            type="button"
            key={chave}
            className={filtro === chave ? 'ativo' : ''}
            onClick={() => setFiltro(chave)}
          >
            {rotulo} ({contagem(chave)})
          </button>
        ))}
      </div>

      <div className="campo" style={{ maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Buscar por número, cliente ou subcliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar OS"
        />
      </div>

      <div className="lista-registros">
        {filtradas.map((os) => (
          <button
            type="button"
            key={os.id}
            className="linha-registro"
            onClick={() => navegar(`/ordens/${os.id}`)}
          >
            <div className="linha-principal">
              <strong>
                {os.numero} — {os.clienteNome}
              </strong>
              <span
                className="badge"
                style={{
                  background: 'var(--cinza-claro)',
                  color: STATUS_OS[os.status]?.cor || '#555555',
                }}
              >
                {rotuloStatusOS(os.status)}
              </span>
            </div>
            <div className="linha-detalhe">
              Abertura: {formatarData(os.dataAbertura)}
              {os.subclienteNome && ` · Subcliente: ${os.subclienteNome}`}
              {` · ${os.totais?.qtdItens || 0} item(ns)`}
              {podeVerValores && ` · ${formatarMoeda(os.totais?.valorTotal)}`}
            </div>
          </button>
        ))}
        {filtradas.length === 0 && (
          <p className="texto-apoio">
            {ordens.length === 0
              ? 'Nenhuma OS aberta ainda.'
              : 'Nenhuma OS encontrada para este filtro.'}
          </p>
        )}
      </div>
    </div>
  );
}
