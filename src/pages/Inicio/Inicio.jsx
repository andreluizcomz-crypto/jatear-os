import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarTodosItens } from '../../services/consultaService';
import { listarOS } from '../../services/osService';
import { listarFaturamentos } from '../../services/faturamentosService';
import { formatarMoeda } from '../../utils/formatadores';
import { hojeInput } from '../../utils/datas';
import { itemAtrasado, itemSemPreco } from '../../utils/regrasItem';

function Destaque({ titulo, valor, detalhe, principal, aoClicar }) {
  return (
    <button
      type="button"
      className={principal ? 'cartao-destaque destaque-principal' : 'cartao-destaque'}
      onClick={aoClicar}
    >
      <span className="titulo-indicador">{titulo}</span>
      <span className="valor-destaque">{valor}</span>
      {detalhe && <span className="detalhe-indicador">{detalhe}</span>}
    </button>
  );
}

function Cartao({ titulo, valor, detalhe, alerta, aoClicar }) {
  return (
    <button
      type="button"
      className={alerta ? 'cartao-indicador indicador-alerta' : 'cartao-indicador'}
      onClick={aoClicar}
    >
      <span className="valor-indicador">{valor}</span>
      <span className="titulo-indicador">{titulo}</span>
      {detalhe && <span className="detalhe-indicador">{detalhe}</span>}
    </button>
  );
}

export default function Inicio() {
  const navegar = useNavigate();
  const { podeVerValores } = useAuth();
  const [itens, setItens] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [faturamentos, setFaturamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([listarTodosItens(), listarOS(), listarFaturamentos()])
      .then(([listaItens, listaOS, listaFat]) => {
        setItens(listaItens);
        setOrdens(listaOS);
        setFaturamentos(listaFat);
      })
      .catch(() => setErro('Não foi possível carregar os indicadores.'))
      .finally(() => setCarregando(false));
  }, []);

  const painel = useMemo(() => {
    const inicioMes = new Date(hojeInput().slice(0, 8) + '01T00:00:00');
    const agora = new Date();
    const noMes = (valor) => {
      const data = valor && typeof valor.toDate === 'function' ? valor.toDate() : valor;
      return data && data >= inicioMes;
    };
    const somar = (lista, fn) =>
      Number(lista.reduce((t, x) => t + (Number(fn(x)) || 0), 0).toFixed(2));

    // Financeiro
    const emitidos = faturamentos.filter((f) => f.status === 'emitido');
    const recebidos = emitidos.filter((f) => f.statusPagamento === 'recebido');
    const aReceber = emitidos.filter((f) => f.statusPagamento !== 'recebido');
    const vencidos = aReceber.filter((f) => {
      const prevista = f.dataPrevistaRecebimento?.toDate?.();
      return prevista && prevista < agora;
    });

    // Itens ainda não faturados (as OS abertas e seus itens sem faturamento)
    const semFaturamento = itens.filter(
      (i) => !i.faturado && i.status !== 'cancelado'
    );
    const porCliente = new Map();
    semFaturamento.forEach((i) => {
      const chave = i.clienteId || i.clienteNome;
      if (!porCliente.has(chave)) {
        porCliente.set(chave, { clienteId: i.clienteId, nome: i.clienteNome, qtd: 0, valor: 0 });
      }
      const grupo = porCliente.get(chave);
      grupo.qtd++;
      grupo.valor = Number((grupo.valor + (Number(i.valorTotalItem) || 0)).toFixed(2));
    });

    const aFaturar = semFaturamento.filter((i) =>
      ['concluido', 'entregue'].includes(i.status)
    );
    const concluidosMes = itens.filter((i) => noMes(i.dataConclusao) && i.status !== 'cancelado');

    return {
      faturadoTotal: somar(emitidos, (f) => f.valorTotal),
      faturadoMes: somar(emitidos.filter((f) => noMes(f.geradoEm)), (f) => f.valorTotal),
      recebidoTotal: somar(recebidos, (f) => f.valorTotal),
      aReceberValor: somar(aReceber, (f) => f.valorTotal),
      aReceberQtd: aReceber.length,
      vencidosQtd: vencidos.length,
      vencidosValor: somar(vencidos, (f) => f.valorTotal),
      semFaturamentoValor: somar(semFaturamento, (i) => i.valorTotalItem),
      semFaturamentoQtd: semFaturamento.length,
      aFaturarQtd: aFaturar.length,
      aFaturarValor: somar(aFaturar, (i) => i.valorTotalItem),
      rankingClientes: [...porCliente.values()].sort((a, b) => b.valor - a.valor).slice(0, 5),
      osAbertas: ordens.filter((os) => ['aberta', 'em_execucao'].includes(os.status)).length,
      emExecucao: itens.filter((i) => i.status === 'em_execucao').length,
      atrasados: itens.filter(itemAtrasado).length,
      semPreco: semFaturamento.filter(itemSemPreco).length,
      areaMes: somar(concluidosMes, (i) => i.areaTotalM2),
      pesoMes: somar(concluidosMes, (i) => i.pesoTotalKg),
    };
  }, [itens, ordens, faturamentos]);

  if (carregando) return <div className="texto-apoio">Carregando indicadores...</div>;

  return (
    <div>
      <h1 className="titulo-pagina">Início</h1>
      {erro && <div className="mensagem-erro">{erro}</div>}

      {podeVerValores && (
        <>
          <div className="grade-destaques">
            <Destaque
              principal
              titulo="Sem faturamento (em aberto)"
              valor={formatarMoeda(painel.semFaturamentoValor)}
              detalhe={`${painel.semFaturamentoQtd} item(ns) · ${formatarMoeda(
                painel.aFaturarValor
              )} já concluído(s) prontos para faturar`}
              aoClicar={() => navegar('/itens?filtro=aberto')}
            />
            <Destaque
              titulo="Total faturado"
              valor={formatarMoeda(painel.faturadoTotal)}
              detalhe={`${formatarMoeda(painel.faturadoMes)} neste mês · ${formatarMoeda(
                painel.recebidoTotal
              )} já recebido`}
              aoClicar={() => navegar('/faturamentos')}
            />
            <Destaque
              titulo="A receber"
              valor={formatarMoeda(painel.aReceberValor)}
              detalhe={
                painel.vencidosQtd > 0
                  ? `${painel.vencidosQtd} faturamento(s) vencido(s) — ${formatarMoeda(
                      painel.vencidosValor
                    )}`
                  : `${painel.aReceberQtd} faturamento(s) aguardando pagamento`
              }
              aoClicar={() => navegar('/faturamentos')}
            />
          </div>

          {painel.rankingClientes.length > 0 && (
            <>
              <h2 className="titulo-secao-dash">Em aberto por cliente</h2>
              <div className="lista-registros" style={{ marginBottom: 20 }}>
                {painel.rankingClientes.map((cliente) => (
                  <button
                    type="button"
                    key={cliente.nome}
                    className="linha-registro linha-ranking"
                    onClick={() =>
                      navegar(
                        `/itens?filtro=aberto${
                          cliente.clienteId ? `&cliente=${cliente.clienteId}` : ''
                        }`
                      )
                    }
                  >
                    <span>
                      <strong>{cliente.nome}</strong>
                      <span className="linha-detalhe"> · {cliente.qtd} item(ns)</span>
                    </span>
                    <strong className="valor-ranking">{formatarMoeda(cliente.valor)}</strong>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <h2 className="titulo-secao-dash">Operação</h2>
      <div className="grade-indicadores">
        <Cartao titulo="OS abertas" valor={painel.osAbertas} aoClicar={() => navegar('/ordens')} />
        <Cartao
          titulo="Itens em execução"
          valor={painel.emExecucao}
          aoClicar={() => navegar('/itens?filtro=execucao')}
        />
        <Cartao
          titulo="Concluídos a faturar"
          valor={painel.aFaturarQtd}
          detalhe={podeVerValores ? formatarMoeda(painel.aFaturarValor) : undefined}
          aoClicar={() => navegar('/itens?filtro=afaturar')}
        />
        <Cartao
          titulo="Itens atrasados"
          valor={painel.atrasados}
          alerta={painel.atrasados > 0}
          aoClicar={() => navegar('/itens?filtro=atrasados')}
        />
        <Cartao
          titulo="Sem preço"
          valor={painel.semPreco}
          alerta={painel.semPreco > 0}
          aoClicar={() => navegar('/itens?filtro=sempreco')}
        />
        <Cartao
          titulo="Produção do mês"
          valor={`${painel.areaMes} m²`}
          detalhe={`${painel.pesoMes} kg`}
          aoClicar={() => navegar('/itens?filtro=mes')}
        />
      </div>
    </div>
  );
}
