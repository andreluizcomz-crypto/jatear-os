import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarTodosItens } from '../../services/consultaService';
import { listarClientes } from '../../services/clientesService';
import { listarServicos } from '../../services/servicosService';
import { formatarData, formatarMoeda } from '../../utils/formatadores';
import { STATUS_ITEM, rotuloStatusItem } from '../../utils/constantes';
import { exportarCsv } from '../../utils/csv';
import { hojeInput } from '../../utils/datas';
import { gerarRelatorioGerencial, gerarRomaneio } from '../../services/pdfService';

const FILTROS_INICIAIS = {
  clientes: [],
  subclientes: [],
  numeroOS: '',
  texto: '',
  servicos: [],
  status: [],
  situacao: 'todos', // aberto | faturado | todos
  periodoInicio: '',
  periodoFim: '',
  criterioData: 'recebimento',
  numeroFaturamento: '',
  notaFiscal: '',
  somenteAtrasados: false,
  somenteSemPreco: false,
  valorMin: '',
  valorMax: '',
};

function paraData(valor) {
  return valor && typeof valor.toDate === 'function' ? valor.toDate() : valor || null;
}

export function itemAtrasado(item) {
  if (['entregue', 'faturado', 'cancelado'].includes(item.status)) return false;
  const prevista = paraData(item.dataPrevistaEntrega);
  if (!prevista) return false;
  return prevista < new Date(hojeInput() + 'T00:00:00');
}

export function itemSemPreco(item) {
  const servicos = item.servicos || [];
  if (servicos.length === 0) return true;
  return servicos.some((s) => !(Number(s.precoUnitario) > 0));
}

const CAMPO_POR_CRITERIO = {
  recebimento: 'dataRecebimento',
  conclusao: 'dataConclusao',
  entrega: 'dataEntrega',
  faturamento: 'dataFaturamento',
};

// Presets dos botões rápidos e dos cartões do dashboard
function presetFiltro(nome) {
  const filtros = { ...FILTROS_INICIAIS };
  const hoje = hojeInput();
  const inicioMes = hoje.slice(0, 8) + '01';
  if (nome === 'afaturar') {
    filtros.situacao = 'aberto';
    filtros.status = ['concluido', 'entregue'];
  } else if (nome === 'aberto') {
    filtros.situacao = 'aberto';
  } else if (nome === 'atrasados') {
    filtros.somenteAtrasados = true;
  } else if (nome === 'faturadomes') {
    filtros.situacao = 'faturado';
    filtros.criterioData = 'faturamento';
    filtros.periodoInicio = inicioMes;
    filtros.periodoFim = hoje;
  } else if (nome === 'semprego' || nome === 'sempreco') {
    filtros.somenteSemPreco = true;
    filtros.situacao = 'aberto';
  } else if (nome === 'execucao') {
    filtros.status = ['em_execucao'];
  } else if (nome === 'mes') {
    filtros.periodoInicio = inicioMes;
    filtros.periodoFim = hoje;
  }
  return filtros;
}

function MultiSelecao({ rotulo, opcoes, valores, onAlterar }) {
  return (
    <div className="campo">
      <label>{rotulo}</label>
      <div className="caixa-multi">
        {opcoes.map((opcao) => (
          <label key={opcao.valor} className="opcao-multi">
            <input
              type="checkbox"
              checked={valores.includes(opcao.valor)}
              onChange={(e) =>
                onAlterar(
                  e.target.checked
                    ? [...valores, opcao.valor]
                    : valores.filter((v) => v !== opcao.valor)
                )
              }
            />
            {opcao.rotulo}
          </label>
        ))}
        {opcoes.length === 0 && <span className="texto-apoio">Nenhuma opção</span>}
      </div>
    </div>
  );
}

export default function Itens() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const { ehAdministrador, podeVerValores, perfilUsuario } = useAuth();
  const podeFaturar = ehAdministrador || perfilUsuario?.perfil === 'faturamento';

  const [itens, setItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtros, setFiltros] = useState(() => {
    const preset = parametros.get('filtro');
    return preset ? presetFiltro(preset) : { ...FILTROS_INICIAIS };
  });
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [mostrarObservacoes, setMostrarObservacoes] = useState(false);
  const [ordenacao, setOrdenacao] = useState({ campo: 'osNumero', direcao: 'asc' });
  const [selecionadas, setSelecionadas] = useState(new Set());

  useEffect(() => {
    Promise.all([listarTodosItens(), listarClientes(), listarServicos()])
      .then(([listaItens, listaClientes, listaServicos]) => {
        setItens(listaItens);
        setClientes(listaClientes);
        setServicos(listaServicos);
      })
      .catch(() => setErro('Não foi possível carregar os itens. Recarregue a página.'))
      .finally(() => setCarregando(false));
  }, []);

  function alterarFiltro(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setSelecionadas(new Set());
  }

  function aplicarPreset(nome) {
    setFiltros(presetFiltro(nome));
    setSelecionadas(new Set());
  }

  const subclientesDisponiveis = useMemo(() => {
    const base =
      filtros.clientes.length > 0
        ? clientes.filter((c) => filtros.clientes.includes(c.id))
        : clientes;
    const nomes = new Set();
    base.forEach((c) => (c.subclientes || []).forEach((s) => s.nome && nomes.add(s.nome)));
    return [...nomes].sort();
  }, [clientes, filtros.clientes]);

  // ---------- Aplicação dos filtros ----------
  const filtrados = useMemo(() => {
    const texto = filtros.texto.trim().toLowerCase();
    const inicio = filtros.periodoInicio
      ? new Date(filtros.periodoInicio + 'T00:00:00')
      : null;
    const fim = filtros.periodoFim ? new Date(filtros.periodoFim + 'T23:59:59') : null;
    const campoData = CAMPO_POR_CRITERIO[filtros.criterioData];

    return itens.filter((item) => {
      if (filtros.clientes.length > 0 && !filtros.clientes.includes(item.clienteId)) return false;
      if (
        filtros.subclientes.length > 0 &&
        !filtros.subclientes.includes(item.subclienteNome || '')
      )
        return false;
      if (
        filtros.numeroOS &&
        !(item.osNumero || '').toLowerCase().includes(filtros.numeroOS.trim().toLowerCase())
      )
        return false;
      if (texto) {
        const alvo = [item.descricao, item.codigoPeca, item.observacoes]
          .join(' ')
          .toLowerCase();
        if (!alvo.includes(texto)) return false;
      }
      if (
        filtros.servicos.length > 0 &&
        !(item.servicos || []).some((s) => filtros.servicos.includes(s.servicoCodigo))
      )
        return false;
      if (filtros.status.length > 0 && !filtros.status.includes(item.status)) return false;
      if (filtros.situacao === 'aberto' && (item.faturado || item.status === 'cancelado'))
        return false;
      if (filtros.situacao === 'faturado' && !item.faturado) return false;
      if (inicio || fim) {
        const data = paraData(item[campoData]);
        if (!data) return false;
        if (inicio && data < inicio) return false;
        if (fim && data > fim) return false;
      }
      if (
        filtros.numeroFaturamento &&
        !(item.faturamentoNumero || '')
          .toLowerCase()
          .includes(filtros.numeroFaturamento.trim().toLowerCase())
      )
        return false;
      if (
        filtros.notaFiscal &&
        !(item.notaFiscal || '').toLowerCase().includes(filtros.notaFiscal.trim().toLowerCase())
      )
        return false;
      if (filtros.somenteAtrasados && !itemAtrasado(item)) return false;
      if (filtros.somenteSemPreco && !itemSemPreco(item)) return false;
      const valor = Number(item.valorTotalItem) || 0;
      if (filtros.valorMin !== '' && valor < Number(filtros.valorMin)) return false;
      if (filtros.valorMax !== '' && valor > Number(filtros.valorMax)) return false;
      return true;
    });
  }, [itens, filtros]);

  // ---------- Ordenação ----------
  const ordenados = useMemo(() => {
    const { campo, direcao } = ordenacao;
    const valorDe = (item) => {
      if (campo === 'valor') return Number(item.valorTotalItem) || 0;
      if (campo === 'peso') return Number(item.pesoTotalKg) || 0;
      if (campo === 'area') return Number(item.areaTotalM2) || 0;
      if (campo === 'qtd') return Number(item.quantidade) || 0;
      if (campo === 'recebimento') return paraData(item.dataRecebimento)?.getTime() || 0;
      if (campo === 'conclusao') return paraData(item.dataConclusao)?.getTime() || 0;
      if (campo === 'seq') return Number(item.sequencia) || 0;
      return String(item[campo] || '').toLowerCase();
    };
    const fator = direcao === 'asc' ? 1 : -1;
    return [...filtrados].sort((a, b) => {
      const va = valorDe(a);
      const vb = valorDe(b);
      if (va < vb) return -1 * fator;
      if (va > vb) return 1 * fator;
      return 0;
    });
  }, [filtrados, ordenacao]);

  function ordenarPor(campo) {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: 'asc' }
    );
  }

  const totais = useMemo(() => {
    const soma = (fn) =>
      Number(filtrados.reduce((t, i) => t + (Number(fn(i)) || 0), 0).toFixed(2));
    return {
      registros: filtrados.length,
      qtd: soma((i) => i.quantidade),
      peso: soma((i) => i.pesoTotalKg),
      area: soma((i) => i.areaTotalM2),
      valor: soma((i) => i.valorTotalItem),
    };
  }, [filtrados]);

  // ---------- Seleção ----------
  const chave = (item) => `${item.osId}_${item.id}`;
  function alternarSelecao(item) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      const c = chave(item);
      if (novo.has(c)) novo.delete(c);
      else novo.add(c);
      return novo;
    });
  }
  const todosDoFiltro = filtrados.length > 0 && filtrados.every((i) => selecionadas.has(chave(i)));
  function alternarTodosDoFiltro() {
    setSelecionadas(todosDoFiltro ? new Set() : new Set(filtrados.map(chave)));
  }
  const itensSelecionados = filtrados.filter((i) => selecionadas.has(chave(i)));

  // ---------- Exportação ----------
  function exportar() {
    const cabecalhos = [
      'OS', 'Seq', 'Descrição', 'Cód. peça', 'Cliente', 'Subcliente', 'Serviços', 'Qtd',
      'Peso (kg)', 'Área (m²)',
      ...(podeVerValores ? ['Valor'] : []),
      'Recebimento', 'Conclusão', 'Observações', 'Status', 'Faturamento', 'NF',
    ];
    exportarCsv(
      `itens-${hojeInput()}.csv`,
      cabecalhos,
      ordenados.map((item) => [
        item.osNumero, item.sequencia, item.descricao, item.codigoPeca || '',
        item.clienteNome, item.subclienteNome || '',
        (item.servicos || []).map((s) => s.servicoCodigo).join(', '),
        item.quantidade,
        String(item.pesoTotalKg ?? '').replace('.', ','),
        String(item.areaTotalM2 ?? '').replace('.', ','),
        ...(podeVerValores ? [String(item.valorTotalItem ?? '').replace('.', ',')] : []),
        formatarData(item.dataRecebimento), formatarData(item.dataConclusao),
        item.observacoes || '', rotuloStatusItem(item.status),
        item.faturamentoNumero || '', item.notaFiscal || '',
      ])
    );
  }

  function gerarFaturamento() {
    navegar('/faturamentos/gerar', {
      state: { chaves: itensSelecionados.map((i) => ({ osId: i.osId, itemId: i.id })) },
    });
  }

  if (carregando) return <div className="texto-apoio">Carregando itens...</div>;

  const painelFiltros = (
    <div className="painel-filtros">
      <div className="grade-formulario">
        <MultiSelecao
          rotulo="Cliente"
          opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.razaoSocial }))}
          valores={filtros.clientes}
          onAlterar={(v) => alterarFiltro('clientes', v)}
        />
        <MultiSelecao
          rotulo="Subcliente"
          opcoes={subclientesDisponiveis.map((nome) => ({ valor: nome, rotulo: nome }))}
          valores={filtros.subclientes}
          onAlterar={(v) => alterarFiltro('subclientes', v)}
        />
        <MultiSelecao
          rotulo="Serviço"
          opcoes={servicos.map((s) => ({ valor: s.codigo, rotulo: s.codigo }))}
          valores={filtros.servicos}
          onAlterar={(v) => alterarFiltro('servicos', v)}
        />
        <MultiSelecao
          rotulo="Status do item"
          opcoes={Object.entries(STATUS_ITEM).map(([valor, s]) => ({
            valor,
            rotulo: s.rotulo,
          }))}
          valores={filtros.status}
          onAlterar={(v) => alterarFiltro('status', v)}
        />
        <div className="campo">
          <label>Situação de faturamento</label>
          <select
            value={filtros.situacao}
            onChange={(e) => alterarFiltro('situacao', e.target.value)}
          >
            <option value="aberto">Em aberto (não faturado)</option>
            <option value="faturado">Faturado</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="campo">
          <label>Número da OS</label>
          <input
            value={filtros.numeroOS}
            onChange={(e) => alterarFiltro('numeroOS', e.target.value)}
            placeholder="OS-2026-"
          />
        </div>
        <div className="campo campo-largo">
          <label>Descrição, código da peça ou observações</label>
          <input
            value={filtros.texto}
            onChange={(e) => alterarFiltro('texto', e.target.value)}
            placeholder="Texto livre"
          />
        </div>
        <div className="campo">
          <label>Critério da data</label>
          <select
            value={filtros.criterioData}
            onChange={(e) => alterarFiltro('criterioData', e.target.value)}
          >
            <option value="recebimento">Recebimento</option>
            <option value="conclusao">Conclusão</option>
            <option value="entrega">Entrega</option>
            <option value="faturamento">Faturamento</option>
          </select>
        </div>
        <div className="campo">
          <label>Período — de</label>
          <input
            type="date"
            value={filtros.periodoInicio}
            onChange={(e) => alterarFiltro('periodoInicio', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Período — até</label>
          <input
            type="date"
            value={filtros.periodoFim}
            onChange={(e) => alterarFiltro('periodoFim', e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Número do faturamento</label>
          <input
            value={filtros.numeroFaturamento}
            onChange={(e) => alterarFiltro('numeroFaturamento', e.target.value)}
            placeholder="FAT-2026-"
          />
        </div>
        <div className="campo">
          <label>Nota fiscal</label>
          <input
            value={filtros.notaFiscal}
            onChange={(e) => alterarFiltro('notaFiscal', e.target.value)}
          />
        </div>
        {podeVerValores && (
          <div className="campo">
            <label>Valor mínimo (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              value={filtros.valorMin}
              onChange={(e) => alterarFiltro('valorMin', e.target.value)}
            />
          </div>
        )}
        {podeVerValores && (
          <div className="campo">
            <label>Valor máximo (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              value={filtros.valorMax}
              onChange={(e) => alterarFiltro('valorMax', e.target.value)}
            />
          </div>
        )}
        <div className="campo campo-caixa">
          <label>
            <input
              type="checkbox"
              checked={filtros.somenteAtrasados}
              onChange={(e) => alterarFiltro('somenteAtrasados', e.target.checked)}
            />{' '}
            Somente atrasados
          </label>
        </div>
        <div className="campo campo-caixa">
          <label>
            <input
              type="checkbox"
              checked={filtros.somenteSemPreco}
              onChange={(e) => alterarFiltro('somenteSemPreco', e.target.checked)}
            />{' '}
            Somente com preço pendente
          </label>
        </div>
      </div>
      <div className="acoes-modal">
        <button
          type="button"
          className="botao-secundario"
          onClick={() => {
            setFiltros({ ...FILTROS_INICIAIS });
            setSelecionadas(new Set());
          }}
        >
          Limpar filtros
        </button>
        <button
          type="button"
          className="botao-primario botao-acao so-celular"
          onClick={() => setFiltroAberto(false)}
        >
          Ver resultados
        </button>
      </div>
    </div>
  );

  return (
    <div className="pagina-os">
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Consulta de Itens</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="botao-secundario" onClick={exportar}>
            Exportar CSV
          </button>
          {podeVerValores && (
          <button
            type="button"
            className="botao-secundario"
            onClick={() =>
              gerarRelatorioGerencial(
                ordenados,
                filtros.periodoInicio
                  ? `${filtros.periodoInicio.split('-').reverse().join('/')} a ${filtros.periodoFim
                      .split('-')
                      .reverse()
                      .join('/')}`
                  : 'Filtro atual'
              )
            }
          >
            Exportar PDF
          </button>
          )}
          <button
            type="button"
            className="botao-secundario"
            disabled={itensSelecionados.length === 0}
            onClick={() => gerarRomaneio(itensSelecionados)}
          >
            Romaneio
          </button>
          {podeFaturar && (
            <button
              type="button"
              className="botao-primario botao-acao"
              disabled={itensSelecionados.length === 0}
              onClick={gerarFaturamento}
            >
              Gerar faturamento ({itensSelecionados.length})
            </button>
          )}
        </div>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="filtros-rapidos">
        <button type="button" onClick={() => aplicarPreset('afaturar')}>A faturar</button>
        <button type="button" onClick={() => aplicarPreset('aberto')}>Em aberto</button>
        <button type="button" onClick={() => aplicarPreset('atrasados')}>Atrasados</button>
        <button type="button" onClick={() => aplicarPreset('faturadomes')}>Faturado no mês</button>
        <button type="button" onClick={() => aplicarPreset('sempreco')}>Sem preço</button>
        <button
          type="button"
          className="so-celular-inline"
          onClick={() => setFiltroAberto(true)}
        >
          Filtros...
        </button>
        <button
          type="button"
          onClick={() => setMostrarObservacoes((v) => !v)}
        >
          {mostrarObservacoes ? 'Ocultar observações' : 'Mostrar observações'}
        </button>
      </div>

      {/* Filtro completo: fixo no desktop, painel deslizante no celular */}
      <div className="so-desktop">{painelFiltros}</div>
      {filtroAberto && (
        <div className="modal-fundo so-celular" onClick={() => setFiltroAberto(false)}>
          <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
            <h2 className="titulo-modal">Filtros</h2>
            {painelFiltros}
          </div>
        </div>
      )}

      <div className="totais-consulta">
        <span>Registros: <strong>{totais.registros}</strong></span>
        <span>Qtd: <strong>{totais.qtd}</strong></span>
        <span>Peso: <strong>{totais.peso} kg</strong></span>
        <span>Área: <strong>{totais.area} m²</strong></span>
        {podeVerValores && <span>Valor: <strong>{formatarMoeda(totais.valor)}</strong></span>}
      </div>

      {/* ---------- Desktop: tabela ---------- */}
      <div className="so-desktop rolagem-horizontal">
        <table className="tabela-itens tabela-consulta">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={todosDoFiltro}
                  onChange={alternarTodosDoFiltro}
                  title="Selecionar tudo do filtro"
                />
              </th>
              <th onClick={() => ordenarPor('osNumero')}>OS</th>
              <th onClick={() => ordenarPor('seq')}>Seq</th>
              <th onClick={() => ordenarPor('descricao')}>Descrição</th>
              <th onClick={() => ordenarPor('clienteNome')}>Cliente</th>
              <th onClick={() => ordenarPor('subclienteNome')}>Subcliente</th>
              <th>Serviço</th>
              <th onClick={() => ordenarPor('qtd')}>Qtd</th>
              <th onClick={() => ordenarPor('peso')}>Peso</th>
              <th onClick={() => ordenarPor('area')}>m²</th>
              {podeVerValores && <th onClick={() => ordenarPor('valor')}>Valor</th>}
              <th onClick={() => ordenarPor('recebimento')}>Recebimento</th>
              <th onClick={() => ordenarPor('conclusao')}>Conclusão</th>
              {mostrarObservacoes && <th>Observações</th>}
              <th onClick={() => ordenarPor('status')}>Status</th>
              <th>Faturamento</th>
              <th>NF</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((item) => (
              <tr
                key={chave(item)}
                className={itemAtrasado(item) ? 'linha-atrasada' : ''}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selecionadas.has(chave(item))}
                    onChange={() => alternarSelecao(item)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="link-tabela"
                    onClick={() => navegar(`/ordens/${item.osId}`)}
                  >
                    {item.osNumero}
                  </button>
                </td>
                <td>{item.sequencia}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 160 }}>
                  {item.descricao}
                  {itemSemPreco(item) && !item.faturado && item.status !== 'cancelado' && (
                    <span className="badge badge-alerta" title="Serviço sem preço"> sem preço</span>
                  )}
                </td>
                <td>{item.clienteNome}</td>
                <td>{item.subclienteNome || ''}</td>
                <td>{(item.servicos || []).map((s) => s.servicoCodigo).join(', ')}</td>
                <td>{item.quantidade}</td>
                <td>{item.pesoTotalKg || ''}</td>
                <td>{item.areaTotalM2 || ''}</td>
                {podeVerValores && (
                  <td className="celula-valor">{formatarMoeda(item.valorTotalItem)}</td>
                )}
                <td>{formatarData(item.dataRecebimento)}</td>
                <td>{formatarData(item.dataConclusao)}</td>
                {mostrarObservacoes && (
                  <td style={{ whiteSpace: 'normal', minWidth: 160 }} title={item.observacoes}>
                    {item.observacoes || ''}
                  </td>
                )}
                <td>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--cinza-claro)',
                      color: STATUS_ITEM[item.status]?.cor,
                    }}
                  >
                    {rotuloStatusItem(item.status)}
                    {itemAtrasado(item) && ' · atrasado'}
                  </span>
                </td>
                <td>{item.faturamentoNumero || ''}</td>
                <td>{item.notaFiscal || ''}</td>
              </tr>
            ))}
            {ordenados.length === 0 && (
              <tr>
                <td colSpan={17} className="texto-apoio" style={{ padding: 16 }}>
                  Nenhum item encontrado para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- Celular: cartões ---------- */}
      <div className="so-celular lista-registros">
        {ordenados.map((item) => (
          <div key={chave(item)} className="linha-registro" style={{ display: 'block' }}>
            <div className="linha-principal">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selecionadas.has(chave(item))}
                  onChange={() => alternarSelecao(item)}
                />
                <strong>{item.descricao}</strong>
              </label>
              <span
                className="badge"
                style={{ background: 'var(--cinza-claro)', color: STATUS_ITEM[item.status]?.cor }}
              >
                {rotuloStatusItem(item.status)}
              </span>
            </div>
            <div className="linha-detalhe" onClick={() => navegar(`/ordens/${item.osId}`)}>
              {item.osNumero} · {item.clienteNome}
              {item.subclienteNome && ` · ${item.subclienteNome}`}
              {podeVerValores && ` · ${formatarMoeda(item.valorTotalItem)}`}
              {itemAtrasado(item) && ' · ATRASADO'}
            </div>
          </div>
        ))}
        {ordenados.length === 0 && (
          <p className="texto-apoio">Nenhum item encontrado para os filtros atuais.</p>
        )}
      </div>
    </div>
  );
}
