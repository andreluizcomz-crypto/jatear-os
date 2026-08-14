import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarClientes } from '../../services/clientesService';
import { listarServicos } from '../../services/servicosService';
import {
  atualizarCabecalhoOS,
  buscarOS,
  cancelarOS,
  criarOS,
  sugerirNumeroOS,
} from '../../services/osService';
import { registrarLog } from '../../services/logsService';
import {
  calcularItem,
  excluirItem,
  listarItens,
  salvarItens,
  sugerirQuantidadeCobrada,
} from '../../services/itensService';
import {
  dataParaInput,
  hojeInput,
  inputParaTimestamp,
  somarDias,
} from '../../utils/datas';
import { formatarCnpj, formatarMoeda } from '../../utils/formatadores';
import { gerarPdfOS } from '../../services/pdfService';
import { ehRetrocesso, rotuloStatusOS } from '../../utils/constantes';
import GradeItens from './GradeItens';
import ItemEditor from './ItemEditor';
import AcoesLote from './AcoesLote';
import Confirmacao from '../../components/Confirmacao';
import Justificativa from '../../components/Justificativa';

const camposDataItem = ['dataRecebimento', 'dataPrevistaEntrega', 'dataConclusao', 'dataEntrega'];

function itemDoBanco(item) {
  const convertido = { ...item };
  camposDataItem.forEach((campo) => {
    convertido[campo] = dataParaInput(item[campo]);
  });
  return convertido;
}

function itemParaBanco(item) {
  const convertido = { ...item };
  camposDataItem.forEach((campo) => {
    convertido[campo] = inputParaTimestamp(item[campo]);
  });
  return convertido;
}

function traduzirErroOS(mensagem) {
  if (mensagem === 'numero-invalido')
    return 'O número da OS deve seguir o formato OS-AAAA-NNNN (ex.: OS-2026-0001).';
  if (mensagem === 'numero-duplicado')
    return 'Já existe uma OS com este número. Informe outro número.';
  if (mensagem === 'cliente-bloqueado')
    return 'Não é possível trocar o cliente: esta OS já possui item faturado.';
  return 'Não foi possível salvar. Verifique sua permissão e tente novamente.';
}

export default function OSForm() {
  const { id } = useParams();
  const ehNova = !id;
  const navegar = useNavigate();
  const { usuario, ehAdministrador, perfilUsuario } = useAuth();
  const podeEditar = ehAdministrador || perfilUsuario?.perfil === 'producao';

  const [os, setOs] = useState(null); // documento salvo (para OS existente)
  const [cabecalho, setCabecalho] = useState({
    numero: '',
    clienteId: '',
    subclienteNome: '',
    pedidoCompraCliente: '',
    solicitante: '',
    contatoCliente: '',
    dataAbertura: hojeInput(),
    dataPrevistaEntrega: '',
    observacoes: '',
  });
  const [itens, setItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [indiceEditor, setIndiceEditor] = useState(null);
  const [indiceExcluir, setIndiceExcluir] = useState(null);
  const [selecionados, setSelecionados] = useState(new Set());
  const [indiceCancelarItem, setIndiceCancelarItem] = useState(null);
  const [modalEncerrar, setModalEncerrar] = useState(false);
  const [modalCancelarOS, setModalCancelarOS] = useState(false);

  const clienteSelecionado = clientes.find((c) => c.id === cabecalho.clienteId);

  async function carregarTudo() {
    const [listaClientes, listaServicos] = await Promise.all([
      listarClientes(),
      listarServicos(),
    ]);
    setClientes(listaClientes.filter((c) => c.ativo !== false));
    setServicos(listaServicos.filter((s) => s.ativo !== false));

    if (ehNova) {
      setCabecalho((atual) => ({ ...atual, numero: '' }));
      const numero = await sugerirNumeroOS();
      setCabecalho((atual) => ({ ...atual, numero }));
    } else {
      const registro = await buscarOS(id);
      if (!registro) {
        setErro('OS não encontrada.');
        return;
      }
      setOs(registro);
      setCabecalho({
        numero: registro.numero,
        clienteId: registro.clienteId,
        subclienteNome: registro.subclienteNome || '',
        pedidoCompraCliente: registro.pedidoCompraCliente || '',
        solicitante: registro.solicitante || '',
        contatoCliente: registro.contatoCliente || '',
        dataAbertura: dataParaInput(registro.dataAbertura),
        dataPrevistaEntrega: dataParaInput(registro.dataPrevistaEntrega),
        observacoes: registro.observacoes || '',
      });
      setItens((await listarItens(id)).map(itemDoBanco));
    }
  }

  useEffect(() => {
    carregarTudo()
      .catch(() => setErro('Não foi possível carregar os dados. Recarregue a página.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- Cabeçalho ----------
  function alterarCabecalho(campo, valor) {
    setCabecalho((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === 'clienteId') {
        const cliente = clientes.find((c) => c.id === valor);
        if (cliente && !atual.dataPrevistaEntrega) {
          novo.dataPrevistaEntrega = somarDias(
            novo.dataAbertura || hojeInput(),
            cliente.prazoPadraoDias || 0
          );
        }
        novo.subclienteNome = '';
      }
      return novo;
    });
  }

  function montarCabecalhoParaBanco() {
    const cliente = clientes.find((c) => c.id === cabecalho.clienteId);
    return {
      numero: cabecalho.numero.trim().toUpperCase(),
      clienteId: cabecalho.clienteId,
      clienteNome: cliente ? cliente.razaoSocial : '',
      subclienteNome: cabecalho.subclienteNome.trim(),
      pedidoCompraCliente: cabecalho.pedidoCompraCliente,
      solicitante: cabecalho.solicitante,
      contatoCliente: cabecalho.contatoCliente,
      dataAbertura: inputParaTimestamp(cabecalho.dataAbertura),
      dataPrevistaEntrega: inputParaTimestamp(cabecalho.dataPrevistaEntrega),
      observacoes: cabecalho.observacoes,
    };
  }

  // ---------- Preço sugerido (regra 7.4) ----------
  function sugerirPreco(servicoCodigo) {
    const daTabela = (clienteSelecionado?.tabelaPrecos || []).find(
      (p) => p.servicoCodigo === servicoCodigo
    );
    if (daTabela) return Number(daTabela.preco) || 0;
    const doCatalogo = servicos.find((s) => s.codigo === servicoCodigo);
    return doCatalogo ? Number(doCatalogo.precoPadrao) || 0 : 0;
  }

  // ---------- Itens ----------
  function novoItemBase(sequencia) {
    return {
      sequencia,
      descricao: '',
      codigoPeca: '',
      quantidade: 1,
      pesoUnitarioKg: '',
      areaUnitariaM2: '',
      dataRecebimento: hojeInput(),
      dataPrevistaEntrega: cabecalho.dataPrevistaEntrega || '',
      dataConclusao: '',
      dataEntrega: '',
      servicos: [],
      valorTotalItem: 0,
      status: 'recebido',
      faturado: false,
      faturamentoId: null,
      notaFiscal: '',
      observacoes: '',
      fotos: [],
      _alterado: true,
    };
  }

  const proximaSequencia = () =>
    itens.reduce((maior, i) => Math.max(maior, i.sequencia || 0), 0) + 1;

  function atualizarItem(indice, transformar) {
    setItens((atuais) =>
      atuais.map((item, i) =>
        i === indice ? { ...calcularItem(transformar(item)), _alterado: true } : item
      )
    );
  }

  // Aplica um status a um item, com datas automáticas (editáveis depois)
  function aplicarStatus(item, novoStatus) {
    const atualizado = { ...item, status: novoStatus };
    if (['concluido', 'entregue'].includes(novoStatus) && !atualizado.dataConclusao) {
      atualizado.dataConclusao = hojeInput();
    }
    if (novoStatus === 'entregue' && !atualizado.dataEntrega) {
      atualizado.dataEntrega = hojeInput();
    }
    return atualizado;
  }

  function cancelarItemLocal(item, justificativa) {
    const observacoes = [item.observacoes, `Cancelado: ${justificativa}`]
      .filter(Boolean)
      .join(' | ');
    return { ...item, status: 'cancelado', observacoes };
  }

  const acoesGrade = {
    alternarSelecionado(indice) {
      setSelecionados((atual) => {
        const novo = new Set(atual);
        if (novo.has(indice)) novo.delete(indice);
        else novo.add(indice);
        return novo;
      });
    },
    alternarTodos() {
      setSelecionados((atual) =>
        atual.size === itens.length ? new Set() : new Set(itens.map((_, i) => i))
      );
    },
    alterarStatus(indice, novoStatus) {
      const item = itens[indice];
      if (novoStatus === item.status) return;
      if (
        ['concluido', 'entregue'].includes(novoStatus) &&
        (item.servicos || []).length === 0
      ) {
        setErro(`O item ${item.sequencia} não tem serviço lançado e não pode ser concluído.`);
        return;
      }
      if (novoStatus === 'cancelado') {
        setIndiceCancelarItem(indice);
        return;
      }
      if (ehRetrocesso(item.status, novoStatus)) {
        registrarLog(
          'status_retrocedido',
          'ordens_servico',
          id,
          { itemId: item.id || null, sequencia: item.sequencia, de: item.status, para: novoStatus },
          usuario.uid
        );
      }
      setErro('');
      atualizarItem(indice, (i) => aplicarStatus(i, novoStatus));
    },
    alterarItem(indice, campo, valor) {
      atualizarItem(indice, (item) => {
        const novo = { ...item, [campo]: valor };
        if (['quantidade', 'pesoUnitarioKg', 'areaUnitariaM2'].includes(campo)) {
          novo.servicos = (novo.servicos || []).map((servico) =>
            servico.qtdManual
              ? servico
              : { ...servico, quantidadeCobrada: sugerirQuantidadeCobrada(servico.unidade, novo) }
          );
        }
        return novo;
      });
    },
    alterarServicoPrincipal(indice, servicoCodigo) {
      atualizarItem(indice, (item) => {
        if (!servicoCodigo) return { ...item, servicos: (item.servicos || []).slice(1) };
        const catalogo = servicos.find((s) => s.codigo === servicoCodigo);
        const principal = {
          ...(item.servicos?.[0] || {}),
          servicoCodigo,
          servicoNome: catalogo?.nome || '',
          unidade: catalogo?.unidadePadrao || 'm2',
          precoUnitario: sugerirPreco(servicoCodigo),
          qtdManual: false,
          esquemaPintura: item.servicos?.[0]?.esquemaPintura || '',
          corRal: item.servicos?.[0]?.corRal || '',
          espessuraEspecificada: item.servicos?.[0]?.espessuraEspecificada || '',
        };
        principal.quantidadeCobrada = sugerirQuantidadeCobrada(principal.unidade, item);
        return { ...item, servicos: [principal, ...(item.servicos || []).slice(1)] };
      });
    },
    alterarQtdCobrada(indice, valor) {
      atualizarItem(indice, (item) => ({
        ...item,
        servicos: item.servicos.map((s, i) =>
          i === 0 ? { ...s, quantidadeCobrada: valor, qtdManual: true } : s
        ),
      }));
    },
    alterarPrecoUnitario(indice, valor) {
      atualizarItem(indice, (item) => ({
        ...item,
        servicos: item.servicos.map((s, i) => (i === 0 ? { ...s, precoUnitario: valor } : s)),
      }));
    },
    adicionar() {
      setItens((atuais) => [...atuais, novoItemBase(proximaSequencia())]);
    },
    duplicar(indice) {
      setItens((atuais) => {
        const origem = atuais[indice];
        const copia = {
          ...calcularItem(origem),
          id: undefined,
          sequencia: proximaSequencia(),
          status: 'recebido',
          faturado: false,
          faturamentoId: null,
          notaFiscal: '',
          dataConclusao: '',
          dataEntrega: '',
          fotos: [],
          _alterado: true,
        };
        return [...atuais, copia];
      });
    },
    editar(indice) {
      setIndiceEditor(indice);
    },
    excluir(indice) {
      setIndiceExcluir(indice);
    },
    importarCsv(arquivo) {
      const leitor = new FileReader();
      leitor.onload = () => {
        try {
          const linhas = String(leitor.result)
            .split(/\r?\n/)
            .filter((l) => l.trim());
          if (linhas.length === 0) return;
          const separador =
            (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length
              ? ';'
              : ',';
          const inicio = /descri/i.test(linhas[0]) ? 1 : 0;
          const numeroBr = (v) => {
            const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
          };
          const dataBr = (v) => {
            const m = String(v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
          };
          let sequencia = proximaSequencia();
          const novos = [];
          for (let i = inicio; i < linhas.length; i++) {
            const colunas = linhas[i].split(separador).map((v) => v.trim());
            if (!colunas[0]) continue;
            const item = novoItemBase(sequencia++);
            item.descricao = colunas[0];
            item.codigoPeca = colunas[1] || '';
            item.quantidade = numeroBr(colunas[2]) || 1;
            item.pesoUnitarioKg = numeroBr(colunas[3]) || '';
            item.areaUnitariaM2 = numeroBr(colunas[4]) || '';
            const recebimento = dataBr(colunas[7]);
            if (recebimento) item.dataRecebimento = recebimento;
            const previsao = dataBr(colunas[8]);
            if (previsao) item.dataPrevistaEntrega = previsao;
            item.observacoes = colunas[9] || '';
            const codigo = (colunas[5] || '').toUpperCase();
            const catalogo = servicos.find((s) => s.codigo === codigo);
            if (catalogo) {
              item.servicos = [
                {
                  servicoCodigo: catalogo.codigo,
                  servicoNome: catalogo.nome,
                  unidade: catalogo.unidadePadrao,
                  quantidadeCobrada: sugerirQuantidadeCobrada(catalogo.unidadePadrao, item),
                  precoUnitario: colunas[6] ? numeroBr(colunas[6]) : sugerirPreco(catalogo.codigo),
                  valor: 0,
                  esquemaPintura: '',
                  corRal: '',
                  espessuraEspecificada: '',
                  qtdManual: false,
                },
              ];
            }
            novos.push(calcularItem(item));
          }
          setItens((atuais) => [...atuais, ...novos]);
          setAviso(
            `${novos.length} item(ns) importado(s). Confira os dados e clique em Salvar alterações.`
          );
        } catch (_) {
          setErro('Não foi possível ler o arquivo CSV. Confira o formato das colunas.');
        }
      };
      leitor.readAsText(arquivo, 'utf-8');
    },
  };

  // ---------- Ações em lote ----------
  function aplicarLote(tipo, valor) {
    setErro('');
    setAviso('');
    if (tipo === 'status' && valor === 'cancelado') {
      setIndiceCancelarItem('lote');
      return;
    }
    let pulados = 0;
    const novos = itens.map((item, i) => {
      if (!selecionados.has(i) || item.faturado) return item;
      let novo = item;
      if (tipo === 'status') {
        if (item.status === 'cancelado' && !ehAdministrador) {
          pulados++;
          return item;
        }
        if (['concluido', 'entregue'].includes(valor) && (item.servicos || []).length === 0) {
          pulados++;
          return item;
        }
        if (ehRetrocesso(item.status, valor) && !ehAdministrador) {
          pulados++;
          return item;
        }
        novo = aplicarStatus(item, valor);
      } else if (tipo === 'dataConclusao') {
        novo = { ...item, dataConclusao: valor };
      } else if (tipo === 'dataPrevista') {
        novo = { ...item, dataPrevistaEntrega: valor };
      } else if (tipo === 'observacao') {
        novo = { ...item, observacoes: valor };
      } else if (tipo === 'servico') {
        const catalogo = servicos.find((s) => s.codigo === valor);
        if (!catalogo) return item;
        const principal = {
          servicoCodigo: catalogo.codigo,
          servicoNome: catalogo.nome,
          unidade: catalogo.unidadePadrao,
          quantidadeCobrada: sugerirQuantidadeCobrada(catalogo.unidadePadrao, item),
          precoUnitario: sugerirPreco(catalogo.codigo),
          valor: 0,
          esquemaPintura: '',
          corRal: '',
          espessuraEspecificada: '',
          qtdManual: false,
        };
        novo = { ...item, servicos: [principal, ...(item.servicos || []).slice(1)] };
      } else if (tipo === 'preco') {
        if (!(item.servicos || []).length) {
          pulados++;
          return item;
        }
        novo = {
          ...item,
          servicos: item.servicos.map((s, j) => (j === 0 ? { ...s, precoUnitario: valor } : s)),
        };
      }
      return { ...calcularItem(novo), _alterado: true };
    });
    setItens(novos);
    setAviso(
      pulados > 0
        ? `Aplicado; ${pulados} item(ns) não puderam ser alterados. Clique em Salvar alterações.`
        : 'Aplicado aos itens selecionados. Clique em Salvar alterações para gravar.'
    );
  }

  function confirmarCancelamentoItem(justificativa) {
    if (indiceCancelarItem === 'lote') {
      setItens((atuais) =>
        atuais.map((item, i) =>
          selecionados.has(i) && !item.faturado && item.status !== 'cancelado'
            ? { ...cancelarItemLocal(item, justificativa), _alterado: true }
            : item
        )
      );
      setAviso('Itens cancelados. Clique em Salvar alterações para gravar.');
    } else {
      atualizarItem(indiceCancelarItem, (item) => cancelarItemLocal(item, justificativa));
    }
    setIndiceCancelarItem(null);
  }

  // ---------- Encerrar / cancelar OS ----------
  async function confirmarEncerramento(justificativa) {
    setModalEncerrar(false);
    const novos = itens.map((item) =>
      ['recebido', 'em_execucao'].includes(item.status)
        ? { ...cancelarItemLocal(item, justificativa), _alterado: true }
        : item
    );
    setItens(novos);
    await persistir(novos);
    registrarLog('os_encerrada', 'ordens_servico', id, { motivo: justificativa }, usuario.uid);
  }

  async function confirmarCancelamentoOS(justificativa) {
    setModalCancelarOS(false);
    const novos = itens.map((item) =>
      !item.faturado && item.status !== 'cancelado'
        ? { ...cancelarItemLocal(item, justificativa), _alterado: true }
        : item
    );
    setItens(novos);
    await persistir(novos);
    await cancelarOS(id, justificativa, usuario.uid);
    setOs(await buscarOS(id));
  }

  async function confirmarExclusao() {
    const indice = indiceExcluir;
    setIndiceExcluir(null);
    setSelecionados(new Set());
    const item = itens[indice];
    if (item.id) {
      try {
        await excluirItem(id, item.id, usuario.uid);
      } catch (_) {
        setErro('Não foi possível excluir o item. Tente novamente.');
        return;
      }
    }
    setItens((atuais) =>
      atuais.filter((_, i) => i !== indice).map((it, i) => ({ ...it, sequencia: i + 1, _alterado: true }))
    );
  }

  // ---------- Totais (calculados em tela) ----------
  const totais = useMemo(() => {
    const ativos = itens.filter((i) => i.status !== 'cancelado');
    const soma = (fn) => Number(ativos.reduce((t, i) => t + (Number(fn(i)) || 0), 0).toFixed(2));
    const valorTotal = soma((i) => i.valorTotalItem);
    const valorFaturado = Number(
      ativos
        .filter((i) => i.faturado)
        .reduce((t, i) => t + (i.valorTotalItem || 0), 0)
        .toFixed(2)
    );
    return {
      qtdItens: ativos.length,
      qtdPecas: soma((i) => i.quantidade),
      pesoTotalKg: soma((i) => i.pesoTotalKg),
      areaTotalM2: soma((i) => i.areaTotalM2),
      valorTotal,
      valorAFaturar: Number((valorTotal - valorFaturado).toFixed(2)),
    };
  }, [itens]);

  // ---------- Salvar ----------
  async function persistir(itensAtuais) {
    setErro('');
    setAviso('');
    if (!cabecalho.clienteId) {
      setErro('Selecione o cliente da OS.');
      return;
    }
    const semDescricao = itensAtuais.some(
      (i) => !(i.descricao || '').trim() || !i.dataRecebimento
    );
    if (semDescricao) {
      setErro('Todo item precisa de descrição e data de recebimento antes de salvar.');
      return;
    }
    setSalvando(true);
    try {
      const dadosCabecalho = montarCabecalhoParaBanco();
      if (ehNova) {
        const novoId = await criarOS(dadosCabecalho, usuario.uid);
        navegar(`/ordens/${novoId}`, { replace: true });
        return;
      }
      await atualizarCabecalhoOS(
        id,
        dadosCabecalho,
        { numero: os.numero, clienteId: os.clienteId, subclienteNome: os.subclienteNome },
        itensAtuais,
        usuario.uid
      );
      await salvarItens(id, dadosCabecalho, itensAtuais.map(itemParaBanco), usuario.uid);
      const registro = await buscarOS(id);
      setOs(registro);
      setItens((await listarItens(id)).map(itemDoBanco));
      setSelecionados(new Set());
      setAviso('Alterações salvas.');
    } catch (excecao) {
      setErro(traduzirErroOS(excecao.message));
    } finally {
      setSalvando(false);
    }
  }

  const aoSalvar = () => persistir(itens);

  if (carregando) return <div className="texto-apoio">Carregando OS...</div>;

  const subclientesSugeridos = (clienteSelecionado?.subclientes || []).filter(
    (s) => s.ativo !== false
  );

  return (
    <div className="pagina-os">
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{ehNova ? 'Nova Ordem de Serviço' : cabecalho.numero}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {os && (
            <span className="badge" style={{ background: 'var(--cinza-claro)' }}>
              {rotuloStatusOS(os.status)}
            </span>
          )}
          {os && (
            <button
              type="button"
              className="botao-secundario"
              onClick={() =>
                gerarPdfOS(
                  { ...os, ...montarCabecalhoParaBanco() },
                  clienteSelecionado
                    ? { cnpj: formatarCnpj(clienteSelecionado.cnpj) }
                    : null,
                  itens
                )
              }
            >
              Imprimir OS
            </button>
          )}
          {os &&
            os.status !== 'cancelada' &&
            podeEditar &&
            itens.some((i) => ['recebido', 'em_execucao'].includes(i.status)) && (
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setModalEncerrar(true)}
              >
                Encerrar OS
              </button>
            )}
          {os &&
            os.status !== 'cancelada' &&
            ehAdministrador &&
            !itens.some((i) => i.faturado) && (
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setModalCancelarOS(true)}
              >
                Cancelar OS
              </button>
            )}
        </div>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}
      {aviso && <div className="mensagem-sucesso">{aviso}</div>}

      <div className="cartao">
        <fieldset disabled={!podeEditar || salvando} style={{ border: 'none' }}>
          <div className="grade-formulario">
            <div className="campo">
              <label htmlFor="numero">Número da OS</label>
              <input
                id="numero"
                value={cabecalho.numero}
                onChange={(e) => alterarCabecalho('numero', e.target.value.toUpperCase())}
                placeholder="OS-AAAA-NNNN"
              />
            </div>
            <div className="campo">
              <label htmlFor="cliente">Cliente *</label>
              <select
                id="cliente"
                value={cabecalho.clienteId}
                onChange={(e) => alterarCabecalho('clienteId', e.target.value)}
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.razaoSocial}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="subcliente">Subcliente (cliente final)</label>
              <input
                id="subcliente"
                list="lista-subclientes"
                value={cabecalho.subclienteNome}
                onChange={(e) => alterarCabecalho('subclienteNome', e.target.value)}
                placeholder="Digite ou escolha"
              />
              <datalist id="lista-subclientes">
                {subclientesSugeridos.map((s) => (
                  <option key={s.id} value={s.nome} />
                ))}
              </datalist>
            </div>
            <div className="campo">
              <label htmlFor="pedido">Pedido de compra do cliente</label>
              <input
                id="pedido"
                value={cabecalho.pedidoCompraCliente}
                onChange={(e) => alterarCabecalho('pedidoCompraCliente', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="solicitante">Solicitante</label>
              <input
                id="solicitante"
                value={cabecalho.solicitante}
                onChange={(e) => alterarCabecalho('solicitante', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="contato">Contato do cliente</label>
              <input
                id="contato"
                value={cabecalho.contatoCliente}
                onChange={(e) => alterarCabecalho('contatoCliente', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="abertura">Data de abertura</label>
              <input
                id="abertura"
                type="date"
                value={cabecalho.dataAbertura}
                onChange={(e) => alterarCabecalho('dataAbertura', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="previsao">Previsão de entrega</label>
              <input
                id="previsao"
                type="date"
                value={cabecalho.dataPrevistaEntrega}
                onChange={(e) => alterarCabecalho('dataPrevistaEntrega', e.target.value)}
              />
            </div>
            <div className="campo campo-largo">
              <label htmlFor="observacoes">Observações da OS</label>
              <textarea
                id="observacoes"
                rows={2}
                value={cabecalho.observacoes}
                onChange={(e) => alterarCabecalho('observacoes', e.target.value)}
              />
            </div>
          </div>
        </fieldset>
      </div>

      {ehNova ? (
        <p className="texto-apoio" style={{ marginTop: 16 }}>
          Salve a OS para começar a lançar os itens.
        </p>
      ) : (
        <>
          {selecionados.size > 0 && podeEditar && (
            <div className="so-desktop">
              <AcoesLote
                quantidade={selecionados.size}
                servicos={servicos}
                onAplicar={aplicarLote}
                onLimpar={() => setSelecionados(new Set())}
              />
            </div>
          )}
          <GradeItens
            itens={itens}
            servicos={servicos}
            totais={totais}
            podeEditar={podeEditar && os?.status !== 'cancelada'}
            ehAdministrador={ehAdministrador}
            selecionados={selecionados}
            acoes={acoesGrade}
          />
        </>
      )}

      <div className="rodape-totais">
        <div className="resumo-totais">
          <span>
            Itens: <strong>{totais.qtdItens}</strong>
          </span>
          <span>
            Peso: <strong>{totais.pesoTotalKg} kg</strong>
          </span>
          <span>
            Área: <strong>{totais.areaTotalM2} m²</strong>
          </span>
          <span>
            Total: <strong>{formatarMoeda(totais.valorTotal)}</strong>
          </span>
          <span className="so-desktop-inline">
            A faturar: <strong>{formatarMoeda(totais.valorAFaturar)}</strong>
          </span>
        </div>
        {podeEditar && (
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={aoSalvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : ehNova ? 'Criar OS' : 'Salvar alterações'}
          </button>
        )}
      </div>

      {indiceEditor !== null && (
        <ItemEditor
          item={itens[indiceEditor]}
          osId={id}
          servicos={servicos}
          sugerirPreco={sugerirPreco}
          ehAdministrador={ehAdministrador}
          onFechar={() => setIndiceEditor(null)}
          onSalvar={(itemAtualizado) => {
            setItens((atuais) =>
              atuais.map((item, i) =>
                i === indiceEditor
                  ? { ...calcularItem(itemAtualizado), _alterado: true }
                  : item
              )
            );
            setIndiceEditor(null);
          }}
        />
      )}

      {indiceCancelarItem !== null && (
        <Justificativa
          titulo={
            indiceCancelarItem === 'lote'
              ? 'Cancelar itens selecionados'
              : `Cancelar item ${itens[indiceCancelarItem]?.sequencia}`
          }
          mensagem="O cancelamento fica registrado nas observações do item."
          rotuloConfirmar="Cancelar item(ns)"
          onConfirmar={confirmarCancelamentoItem}
          onCancelar={() => setIndiceCancelarItem(null)}
        />
      )}

      {modalEncerrar && (
        <Justificativa
          titulo="Encerrar OS"
          mensagem="Os itens ainda não concluídos serão cancelados com esta justificativa. Os itens concluídos, entregues ou faturados não são alterados."
          rotuloConfirmar="Encerrar OS"
          onConfirmar={confirmarEncerramento}
          onCancelar={() => setModalEncerrar(false)}
        />
      )}

      {modalCancelarOS && (
        <Justificativa
          titulo="Cancelar OS"
          mensagem="A OS ficará com status Cancelada e todos os itens não faturados serão cancelados. A OS não é excluída."
          rotuloConfirmar="Cancelar OS"
          onConfirmar={confirmarCancelamentoOS}
          onCancelar={() => setModalCancelarOS(false)}
        />
      )}

      {indiceExcluir !== null && (
        <Confirmacao
          mensagem={`Excluir o item ${itens[indiceExcluir].sequencia} — "${
            itens[indiceExcluir].descricao || 'sem descrição'
          }"? Esta ação não pode ser desfeita.`}
          rotuloConfirmar="Excluir item"
          onConfirmar={confirmarExclusao}
          onCancelar={() => setIndiceExcluir(null)}
        />
      )}
    </div>
  );
}
