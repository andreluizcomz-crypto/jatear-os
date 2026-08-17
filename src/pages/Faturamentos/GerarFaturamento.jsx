import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { gerarFaturamento } from '../../services/faturamentosService';
import { buscarOS } from '../../services/osService';
import { formatarMoeda } from '../../utils/formatadores';
import { dataParaInput, inputParaTimestamp } from '../../utils/datas';

function traduzirErroFat(mensagem) {
  const mapa = {
    'clientes-diferentes': 'Selecione itens de um único cliente por faturamento.',
    'item-ja-faturado': 'Um dos itens já foi faturado. Atualize a consulta e tente de novo.',
    'item-nao-concluido': 'Todos os itens precisam estar concluídos ou entregues.',
    'item-sem-preco': 'Há item com serviço sem preço. Ajuste o preço antes de faturar.',
    'item-inexistente': 'Um dos itens não foi encontrado. Atualize a consulta.',
  };
  return mapa[mensagem] || 'Não foi possível gerar o faturamento. Tente novamente.';
}

// Tela de conferência antes da gravação transacional
export default function GerarFaturamento() {
  const navegar = useNavigate();
  const { state } = useLocation();
  const { usuario } = useAuth();
  const chaves = useMemo(() => state?.chaves || [], [state]);

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [problemas, setProblemas] = useState([]);
  const [criterioData, setCriterioData] = useState('conclusao');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [prazoPagamentoDias, setPrazoPagamentoDias] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (chaves.length === 0) {
      setCarregando(false);
      return;
    }
    Promise.all(
      chaves.map(async ({ osId, itemId }) => {
        const registro = await getDoc(doc(db, 'ordens_servico', osId, 'itens', itemId));
        return registro.exists() ? { id: itemId, osId, ...registro.data() } : null;
      })
    )
      .then((lista) => {
        const validos = lista.filter(Boolean);
        setItens(validos);
        const alertas = [];
        if (new Set(validos.map((i) => i.clienteId)).size > 1) {
          alertas.push('Os itens selecionados são de clientes diferentes — não é permitido.');
        }
        if (validos.some((i) => i.faturado)) {
          alertas.push('Há item já faturado na seleção.');
        }
        if (validos.some((i) => !['concluido', 'entregue'].includes(i.status))) {
          alertas.push('Há item que ainda não está concluído ou entregue.');
        }
        if (
          validos.some(
            (i) =>
              !(i.servicos || []).length ||
              i.servicos.some((s) => !(Number(s.precoUnitario) > 0))
          )
        ) {
          alertas.push('Há item com serviço sem preço.');
        }
        setProblemas(alertas);

        // Sugere o período pela menor e maior data de conclusão
        const datas = validos
          .map((i) => i.dataConclusao)
          .filter(Boolean)
          .map((d) => dataParaInput(d))
          .sort();
        if (datas.length > 0) {
          setPeriodoInicio(datas[0]);
          setPeriodoFim(datas[datas.length - 1]);
        }

        // Condições de pagamento sugeridas pelas OS dos itens selecionados
        const osIds = [...new Set(validos.map((i) => i.osId))];
        Promise.all(osIds.map(buscarOS)).then((listaOS) => {
          const formas = new Set(listaOS.map((o) => o?.formaPagamento).filter(Boolean));
          const prazos = new Set(
            listaOS.map((o) => o?.prazoPagamentoDias).filter((p) => Number(p) > 0)
          );
          if (formas.size === 1) setFormaPagamento([...formas][0]);
          if (prazos.size === 1) setPrazoPagamentoDias([...prazos][0]);
        });
      })
      .catch(() => setErro('Não foi possível carregar os itens selecionados.'))
      .finally(() => setCarregando(false));
  }, [chaves]);

  const totais = useMemo(() => {
    const soma = (fn) => Number(itens.reduce((t, i) => t + (Number(fn(i)) || 0), 0).toFixed(2));
    return {
      peso: soma((i) => i.pesoTotalKg),
      area: soma((i) => i.areaTotalM2),
      valor: soma((i) => i.valorTotalItem),
    };
  }, [itens]);

  async function confirmar() {
    setGerando(true);
    setErro('');
    try {
      const subclientes = new Set(itens.map((i) => i.subclienteNome || ''));
      const idGerado = await gerarFaturamento(
        chaves,
        {
          criterioData,
          periodoInicio: inputParaTimestamp(periodoInicio),
          periodoFim: inputParaTimestamp(periodoFim),
          subclienteNome: subclientes.size === 1 ? [...subclientes][0] : '',
          formaPagamento: formaPagamento.trim(),
          prazoPagamentoDias,
          observacoes,
        },
        usuario.uid
      );
      navegar(`/faturamentos/${idGerado}`, { replace: true });
    } catch (excecao) {
      setErro(traduzirErroFat(excecao.message));
      setGerando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando conferência...</div>;

  if (chaves.length === 0) {
    return (
      <div>
        <h1 className="titulo-pagina">Gerar faturamento</h1>
        <div className="cartao">
          <p className="texto-apoio">
            Nenhum item selecionado. Vá até a Consulta de Itens, filtre por "A faturar",
            selecione os itens e clique em "Gerar faturamento".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Conferência do faturamento</h1>
      </div>

      <div className="so-celular mensagem-erro" style={{ background: '#FFF3E0', color: '#ED6C02' }}>
        A geração de faturamento é otimizada para o computador. É possível continuar, mas
        recomendamos o desktop.
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}
      {problemas.map((p) => (
        <div key={p} className="mensagem-erro">
          {p}
        </div>
      ))}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="linha-detalhe" style={{ marginBottom: 12 }}>
          Cliente: <strong>{itens[0]?.clienteNome}</strong> · {itens.length} item(ns) ·{' '}
          {totais.peso} kg · {totais.area} m² · <strong>{formatarMoeda(totais.valor)}</strong>
        </div>
        <div className="grade-formulario">
          <div className="campo">
            <label>Critério da data</label>
            <select value={criterioData} onChange={(e) => setCriterioData(e.target.value)}>
              <option value="recebimento">Recebimento</option>
              <option value="conclusao">Conclusão</option>
              <option value="entrega">Entrega</option>
            </select>
          </div>
          <div className="campo">
            <label>Período — de</label>
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
          </div>
          <div className="campo">
            <label>Período — até</label>
            <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
          <div className="campo">
            <label>Forma de pagamento</label>
            <input
              list="formas-pagamento-fat"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex.: Boleto bancário"
            />
            <datalist id="formas-pagamento-fat">
              <option value="Boleto bancário" />
              <option value="PIX" />
              <option value="Transferência bancária" />
            </datalist>
          </div>
          <div className="campo">
            <label>Prazo de pagamento (dias após a NF)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={prazoPagamentoDias}
              onChange={(e) => setPrazoPagamentoDias(e.target.value)}
              placeholder="Ex.: 30"
            />
          </div>
          <div className="campo campo-largo">
            <label>Observações</label>
            <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rolagem-horizontal" style={{ marginBottom: 16 }}>
        <table className="tabela-itens">
          <thead>
            <tr>
              <th>OS</th>
              <th>Seq</th>
              <th>Descrição</th>
              <th>Subcliente</th>
              <th>Qtd</th>
              <th>Peso (kg)</th>
              <th>m²</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={`${item.osId}_${item.id}`}>
                <td>{item.osNumero}</td>
                <td>{item.sequencia}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{item.descricao}</td>
                <td>{item.subclienteNome || ''}</td>
                <td>{item.quantidade}</td>
                <td>{item.pesoTotalKg || ''}</td>
                <td>{item.areaTotalM2 || ''}</td>
                <td className="celula-valor">{formatarMoeda(item.valorTotalItem)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="acoes-rodape">
        <button type="button" className="botao-secundario" onClick={() => navegar('/itens')}>
          Voltar à consulta
        </button>
        <button
          type="button"
          className="botao-primario botao-acao"
          onClick={confirmar}
          disabled={gerando || problemas.length > 0}
        >
          {gerando ? 'Gerando...' : `Confirmar faturamento (${formatarMoeda(totais.valor)})`}
        </button>
      </div>
    </div>
  );
}
