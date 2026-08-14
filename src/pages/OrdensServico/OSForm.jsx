import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarClientes } from '../../services/clientesService';
import { listarServicos } from '../../services/servicosService';
import {
  atualizarCabecalhoOS,
  buscarOS,
  criarOS,
  sugerirNumeroOS,
} from '../../services/osService';
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
import { formatarMoeda } from '../../utils/formatadores';
import { rotuloStatusOS } from '../../utils/constantes';
import GradeItens from './GradeItens';
import ItemEditor from './ItemEditor';
import Confirmacao from '../../components/Confirmacao';

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

  const acoesGrade = {
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

  async function confirmarExclusao() {
    const indice = indiceExcluir;
    setIndiceExcluir(null);
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
  async function aoSalvar() {
    setErro('');
    setAviso('');
    if (!cabecalho.clienteId) {
      setErro('Selecione o cliente da OS.');
      return;
    }
    const semDescricao = itens.some((i) => !i.descricao.trim() || !i.dataRecebimento);
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
        itens,
        usuario.uid
      );
      await salvarItens(id, dadosCabecalho, itens.map(itemParaBanco), usuario.uid);
      const registro = await buscarOS(id);
      setOs(registro);
      setItens((await listarItens(id)).map(itemDoBanco));
      setAviso('Alterações salvas.');
    } catch (excecao) {
      setErro(traduzirErroOS(excecao.message));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando OS...</div>;

  const subclientesSugeridos = (clienteSelecionado?.subclientes || []).filter(
    (s) => s.ativo !== false
  );

  return (
    <div className="pagina-os">
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{ehNova ? 'Nova Ordem de Serviço' : cabecalho.numero}</h1>
        {os && (
          <span className="badge" style={{ background: 'var(--cinza-claro)' }}>
            {rotuloStatusOS(os.status)}
          </span>
        )}
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
        <GradeItens
          itens={itens}
          servicos={servicos}
          totais={totais}
          podeEditar={podeEditar}
          acoes={acoesGrade}
        />
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
          servicos={servicos}
          sugerirPreco={sugerirPreco}
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
