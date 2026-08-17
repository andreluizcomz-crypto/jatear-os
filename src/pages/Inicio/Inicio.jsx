import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarTodosItens } from '../../services/consultaService';
import { listarOS } from '../../services/osService';
import { listarFaturamentos } from '../../services/faturamentosService';
import { formatarMoeda } from '../../utils/formatadores';
import { hojeInput } from '../../utils/datas';
import { itemAtrasado, itemSemPreco } from '../Itens/Itens';

function Cartao({ titulo, valor, detalhe, aoClicar }) {
  return (
    <button type="button" className="cartao-indicador" onClick={aoClicar}>
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

  const indicadores = useMemo(() => {
    const inicioMes = new Date(hojeInput().slice(0, 8) + '01T00:00:00');
    const noMes = (valor) => {
      const data = valor && typeof valor.toDate === 'function' ? valor.toDate() : valor;
      return data && data >= inicioMes;
    };
    const aFaturar = itens.filter(
      (i) => ['concluido', 'entregue'].includes(i.status) && !i.faturado
    );
    const concluidosMes = itens.filter((i) => noMes(i.dataConclusao) && i.status !== 'cancelado');
    const fatMes = faturamentos.filter((f) => f.status === 'emitido' && noMes(f.geradoEm));
    const soma = (lista, fn) =>
      Number(lista.reduce((t, x) => t + (Number(fn(x)) || 0), 0).toFixed(2));
    return {
      osAbertas: ordens.filter((os) => ['aberta', 'em_execucao'].includes(os.status)).length,
      emExecucao: itens.filter((i) => i.status === 'em_execucao').length,
      aFaturarQtd: aFaturar.length,
      aFaturarValor: soma(aFaturar, (i) => i.valorTotalItem),
      atrasados: itens.filter(itemAtrasado).length,
      semPreco: itens.filter((i) => !i.faturado && i.status !== 'cancelado' && itemSemPreco(i))
        .length,
      areaMes: soma(concluidosMes, (i) => i.areaTotalM2),
      pesoMes: soma(concluidosMes, (i) => i.pesoTotalKg),
      faturadoMes: soma(fatMes, (f) => f.valorTotal),
    };
  }, [itens, ordens, faturamentos]);

  if (carregando) return <div className="texto-apoio">Carregando indicadores...</div>;

  return (
    <div>
      <h1 className="titulo-pagina">Início</h1>
      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="grade-indicadores">
        <Cartao
          titulo="OS abertas"
          valor={indicadores.osAbertas}
          aoClicar={() => navegar('/ordens')}
        />
        <Cartao
          titulo="Itens em execução"
          valor={indicadores.emExecucao}
          aoClicar={() => navegar('/itens?filtro=execucao')}
        />
        <Cartao
          titulo="Concluídos a faturar"
          valor={indicadores.aFaturarQtd}
          detalhe={podeVerValores ? formatarMoeda(indicadores.aFaturarValor) : undefined}
          aoClicar={() => navegar('/itens?filtro=afaturar')}
        />
        <Cartao
          titulo="Itens atrasados"
          valor={indicadores.atrasados}
          aoClicar={() => navegar('/itens?filtro=atrasados')}
        />
        <Cartao
          titulo="Sem preço"
          valor={indicadores.semPreco}
          aoClicar={() => navegar('/itens?filtro=sempreco')}
        />
        <Cartao
          titulo="Produção do mês"
          valor={`${indicadores.areaMes} m²`}
          detalhe={`${indicadores.pesoMes} kg`}
          aoClicar={() => navegar('/itens?filtro=mes')}
        />
        {podeVerValores && (
          <Cartao
            titulo="Faturado no mês"
            valor={formatarMoeda(indicadores.faturadoMes)}
            aoClicar={() => navegar('/itens?filtro=faturadomes')}
          />
        )}
      </div>
    </div>
  );
}
