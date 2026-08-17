import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarFaturamentos } from '../../services/faturamentosService';
import { listarTodosItens } from '../../services/consultaService';
import { formatarData, formatarMoeda } from '../../utils/formatadores';

// Faturamento emitido, não recebido e com vencimento no passado
function vencido(fat) {
  const prevista = fat.dataPrevistaRecebimento?.toDate?.();
  return Boolean(prevista && prevista < new Date());
}

export default function Faturamentos() {
  const navegar = useNavigate();
  const { podeVerValores } = useAuth();
  const [faturamentos, setFaturamentos] = useState([]);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([listarFaturamentos(), listarTodosItens()])
      .then(([listaFat, listaItens]) => {
        setFaturamentos(listaFat);
        setItens(listaItens);
      })
      .catch(() => setErro('Não foi possível carregar os faturamentos.'))
      .finally(() => setCarregando(false));
  }, []);

  const pendentes = useMemo(() => {
    const aFaturar = itens.filter(
      (i) => ['concluido', 'entregue'].includes(i.status) && !i.faturado
    );
    return {
      qtd: aFaturar.length,
      valor: Number(
        aFaturar.reduce((t, i) => t + (Number(i.valorTotalItem) || 0), 0).toFixed(2)
      ),
      clientes: new Set(aFaturar.map((i) => i.clienteNome)).size,
    };
  }, [itens]);

  if (carregando) return <div className="texto-apoio">Carregando faturamentos...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Faturamentos</h1>
      </div>
      {erro && <div className="mensagem-erro">{erro}</div>}

      {pendentes.qtd > 0 ? (
        <div className="faixa-faturamento" style={{ marginBottom: 16 }}>
          <span>
            <strong>{pendentes.qtd} item(ns)</strong> concluído(s) aguardando faturamento
            {pendentes.clientes > 1 && ` (${pendentes.clientes} clientes)`}
            {podeVerValores && (
              <>
                {' '}
                — <strong>{formatarMoeda(pendentes.valor)}</strong>
              </>
            )}
          </span>
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={() => navegar('/itens?filtro=afaturar')}
          >
            Escolher itens e faturar
          </button>
        </div>
      ) : (
        <p className="texto-apoio" style={{ marginBottom: 12 }}>
          Nenhum item concluído aguardando faturamento. Conclua itens nas OS e eles
          aparecerão aqui.
        </p>
      )}

      <div className="lista-registros">
        {faturamentos.map((fat) => (
          <button
            type="button"
            key={fat.id}
            className="linha-registro"
            onClick={() => navegar(`/faturamentos/${fat.id}`)}
          >
            <div className="linha-principal">
              <strong>
                {fat.numero} — {fat.clienteNome}
              </strong>
              <span style={{ display: 'flex', gap: 6 }}>
                {fat.status === 'emitido' && fat.statusPagamento === 'recebido' && (
                  <span className="badge badge-ativo">Recebido</span>
                )}
                {fat.status === 'emitido' &&
                  fat.statusPagamento !== 'recebido' &&
                  (vencido(fat) ? (
                    <span className="badge badge-alerta">Vencido</span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--cinza-claro)', color: '#ED6C02' }}>
                      A receber
                    </span>
                  ))}
                <span
                  className={fat.status === 'emitido' ? 'badge badge-ativo' : 'badge badge-inativo'}
                >
                  {fat.status === 'emitido' ? 'Emitido' : 'Cancelado'}
                </span>
              </span>
            </div>
            <div className="linha-detalhe">
              {formatarData(fat.geradoEm)}
              {fat.periodoInicio &&
                ` · Período: ${formatarData(fat.periodoInicio)} a ${formatarData(fat.periodoFim)}`}
              {` · ${fat.qtdItens} item(ns)`}
              {podeVerValores && ` · ${formatarMoeda(fat.valorTotal)}`}
              {fat.notaFiscal && ` · NF ${fat.notaFiscal}`}
              {fat.dataPrevistaRecebimento &&
                ` · Vencimento: ${formatarData(fat.dataPrevistaRecebimento)}`}
            </div>
          </button>
        ))}
        {faturamentos.length === 0 && (
          <p className="texto-apoio">Nenhum faturamento gerado ainda.</p>
        )}
      </div>
    </div>
  );
}
