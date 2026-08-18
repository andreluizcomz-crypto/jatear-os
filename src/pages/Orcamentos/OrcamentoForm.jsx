import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  STATUS_ORCAMENTO,
  atualizarOrcamento,
  buscarOrcamento,
  criarOrcamento,
  excluirAnexo,
  iniciarEnvioAnexo,
  novoIdOrcamento,
} from '../../services/orcamentosService';
import { listarClientes } from '../../services/clientesService';
import GravadorAudio from '../../components/GravadorAudio';
import Confirmacao from '../../components/Confirmacao';

const ROTULO_TIPO = { foto: 'Foto', video: 'Vídeo', audio: 'Áudio', arquivo: 'Arquivo' };

const orcamentoVazio = {
  clienteNome: '',
  clienteId: null,
  contato: '',
  telefone: '',
  localObra: '',
  observacoes: '',
  valorEstimado: '',
  status: 'aberto',
  lembretes: [],
  itens: [],
  anexos: [], // legado: anexos gerais de orçamentos antigos
};

function novoItemOrcamento(sequencia) {
  return {
    id: crypto.randomUUID(),
    sequencia,
    nome: '',
    descricao: '',
    medidas: '',
    anexos: [],
  };
}

export default function OrcamentoForm() {
  const { id: idRota } = useParams();
  const ehNovo = !idRota;
  const navegar = useNavigate();
  const { usuario, ehAdministrador, podeVerValores, perfilUsuario } = useAuth();
  const podeEditar = ehAdministrador || perfilUsuario?.perfil === 'producao';

  // Novo orçamento já nasce com id — permite anexar mídia antes de salvar
  const [id] = useState(() => idRota || novoIdOrcamento());
  const [dados, setDados] = useState(orcamentoVazio);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(!ehNovo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [envio, setEnvio] = useState(null); // { itemId, tipo, progresso, tarefa }
  const [novoLembrete, setNovoLembrete] = useState('');
  const [anexoExcluir, setAnexoExcluir] = useState(null); // { itemId, anexo }
  const [itemExcluir, setItemExcluir] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  useEffect(() => {
    listarClientes()
      .then((lista) => setClientes(lista.filter((c) => c.ativo !== false)))
      .catch(() => {});
    if (!ehNovo) {
      buscarOrcamento(idRota)
        .then((registro) => {
          if (registro) setDados({ ...orcamentoVazio, ...registro });
          else setErro('Orçamento não encontrado.');
        })
        .catch(() => setErro('Não foi possível carregar o orçamento.'))
        .finally(() => setCarregando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRota]);

  function alterar(campo, valor) {
    setDados((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === 'clienteNome') {
        const cadastro = clientes.find((c) => c.razaoSocial === valor);
        novo.clienteId = cadastro ? cadastro.id : null;
      }
      return novo;
    });
  }

  // ---------- Itens do orçamento ----------
  function adicionarItem() {
    const sequencia = dados.itens.reduce((maior, i) => Math.max(maior, i.sequencia || 0), 0) + 1;
    alterar('itens', [...dados.itens, novoItemOrcamento(sequencia)]);
  }

  function alterarItem(itemId, campo, valor) {
    alterar(
      'itens',
      dados.itens.map((item) => (item.id === itemId ? { ...item, [campo]: valor } : item))
    );
  }

  function confirmarExclusaoItem() {
    const item = itemExcluir;
    setItemExcluir(null);
    (item.anexos || []).forEach((anexo) => anexo.caminho && excluirAnexo(anexo.caminho));
    alterar('itens', dados.itens.filter((i) => i.id !== item.id));
  }

  // ---------- Lembretes ----------
  function adicionarLembrete() {
    if (!novoLembrete.trim()) return;
    alterar('lembretes', [
      ...dados.lembretes,
      { id: crypto.randomUUID(), texto: novoLembrete.trim(), feito: false },
    ]);
    setNovoLembrete('');
  }

  function alternarLembrete(lembreteId) {
    alterar(
      'lembretes',
      dados.lembretes.map((l) => (l.id === lembreteId ? { ...l, feito: !l.feito } : l))
    );
  }

  function removerLembrete(lembreteId) {
    alterar('lembretes', dados.lembretes.filter((l) => l.id !== lembreteId));
  }

  // ---------- Anexos por item ----------
  async function enviarAnexo(itemId, tipo, arquivo, nome) {
    setErro('');
    try {
      const { tarefa, promessa } = await iniciarEnvioAnexo(
        id,
        tipo,
        arquivo,
        nome,
        (progresso) => setEnvio((atual) => ({ ...(atual || {}), itemId, tipo, progresso, tarefa })),
        itemId
      );
      setEnvio({ itemId, tipo, progresso: 0, tarefa });
      const anexo = await promessa;
      setDados((atual) => ({
        ...atual,
        itens: atual.itens.map((item) =>
          item.id === itemId ? { ...item, anexos: [...(item.anexos || []), anexo] } : item
        ),
      }));
      setEnvio(null);
      setAviso('Anexo enviado. Lembre de salvar o orçamento para gravá-lo.');
    } catch (excecao) {
      setEnvio(null);
      if (excecao?.code !== 'storage/canceled') {
        setErro('Não foi possível enviar o anexo. Verifique a conexão e tente novamente.');
      }
    }
  }

  function aoEscolherArquivo(itemId, tipo, evento) {
    const arquivo = evento.target.files[0];
    if (arquivo) enviarAnexo(itemId, tipo, arquivo, arquivo.name);
    evento.target.value = '';
  }

  function confirmarExclusaoAnexo() {
    const { itemId, anexo } = anexoExcluir;
    setAnexoExcluir(null);
    if (anexo.caminho) excluirAnexo(anexo.caminho);
    setDados((atual) => ({
      ...atual,
      itens: atual.itens.map((item) =>
        item.id === itemId
          ? { ...item, anexos: item.anexos.filter((a) => a !== anexo) }
          : item
      ),
      anexos: (atual.anexos || []).filter((a) => a !== anexo),
    }));
  }

  // ---------- Salvar ----------
  async function aoSalvar() {
    setErro('');
    setAviso('');
    if (!dados.clienteNome.trim()) {
      setErro('Informe o cliente do orçamento.');
      return;
    }
    const itensValidos = dados.itens.filter(
      (i) => i.nome.trim() || i.descricao.trim() || (i.anexos || []).length > 0
    );
    if (itensValidos.some((i) => !i.nome.trim())) {
      setErro('Todo item precisa de um nome.');
      return;
    }
    setSalvando(true);
    const corpo = {
      ...dados,
      clienteNome: dados.clienteNome.trim(),
      itens: itensValidos,
      valorEstimado: Number(dados.valorEstimado) || 0,
    };
    delete corpo.id;
    try {
      if (ehNovo && !dados.numero) {
        const numero = await criarOrcamento(id, corpo, usuario.uid);
        setDados((atual) => ({ ...atual, numero, itens: itensValidos }));
        navegar(`/orcamentos/${id}`, { replace: true });
        setAviso(`Orçamento ${numero} criado.`);
      } else {
        await atualizarOrcamento(id, corpo, usuario.uid);
        setDados((atual) => ({ ...atual, itens: itensValidos }));
        setAviso('Orçamento salvo.');
      }
    } catch (_) {
      setErro('Não foi possível salvar. Verifique sua permissão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando orçamento...</div>;

  const totalAnexos =
    dados.itens.reduce((t, i) => t + (i.anexos || []).length, 0) + (dados.anexos || []).length;

  function blocoAnexos(itemId, anexos) {
    const porTipo = (tipo) => anexos.filter((a) => a.tipo === tipo);
    return (
      <>
        {podeEditar && (
          <div className="botoes-anexo">
            <label className="botao-secundario rotulo-foto">
              Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo(itemId, 'foto', e)}
              />
            </label>
            <GravadorAudio
              desabilitado={Boolean(envio)}
              onGravado={(blob, extensao) =>
                enviarAnexo(itemId, 'audio', blob, `gravacao-${Date.now()}.${extensao}`)
              }
            />
            <label className="botao-secundario rotulo-foto">
              Áudio do aparelho
              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo(itemId, 'audio', e)}
              />
            </label>
            <label className="botao-secundario rotulo-foto">
              Vídeo
              <input
                type="file"
                accept="video/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo(itemId, 'video', e)}
              />
            </label>
            <label className="botao-secundario rotulo-foto">
              Arquivo
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo(itemId, 'arquivo', e)}
              />
            </label>
          </div>
        )}

        {envio && envio.itemId === itemId && (
          <div className="barra-progresso" style={{ marginBottom: 12 }}>
            <div className="barra-progresso-interna" style={{ width: `${envio.progresso}%` }} />
            <button type="button" className="acao-excluir" onClick={() => envio.tarefa.cancel()}>
              Cancelar envio de {ROTULO_TIPO[envio.tipo].toLowerCase()} ({envio.progresso}%)
            </button>
          </div>
        )}

        {porTipo('foto').length > 0 && (
          <div className="miniaturas" style={{ marginBottom: 8 }}>
            {porTipo('foto').map((anexo) => (
              <div key={anexo.urlStorage} className="miniatura">
                <img
                  src={anexo.urlStorage}
                  alt="Foto do item"
                  onClick={() => setFotoAmpliada(anexo.urlStorage)}
                />
                {podeEditar && (
                  <button type="button" onClick={() => setAnexoExcluir({ itemId, anexo })}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {porTipo('audio').map((anexo) => (
          <div key={anexo.urlStorage} className="linha-anexo">
            <audio controls src={anexo.urlStorage} preload="none" style={{ flex: 1, minWidth: 0 }} />
            {podeEditar && (
              <button
                type="button"
                className="acao-excluir"
                onClick={() => setAnexoExcluir({ itemId, anexo })}
              >
                Remover
              </button>
            )}
          </div>
        ))}

        {['video', 'arquivo'].map((tipo) =>
          porTipo(tipo).map((anexo) => (
            <div key={anexo.urlStorage} className="linha-anexo">
              <span className="badge badge-ativo">{ROTULO_TIPO[tipo]}</span>
              <a
                href={anexo.urlStorage}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {anexo.nome}
              </a>
              {podeEditar && (
                <button
                  type="button"
                  className="acao-excluir"
                  onClick={() => setAnexoExcluir({ itemId, anexo })}
                >
                  Remover
                </button>
              )}
            </div>
          ))
        )}
      </>
    );
  }

  return (
    <div className="pagina-os">
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{dados.numero || 'Novo orçamento'}</h1>
        <button type="button" className="botao-secundario" onClick={() => navegar('/orcamentos')}>
          Voltar
        </button>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}
      {aviso && <div className="mensagem-sucesso">{aviso}</div>}

      {/* ---------- Cabeçalho ---------- */}
      <div className="cartao" style={{ marginBottom: 16 }}>
        <fieldset disabled={!podeEditar || salvando} style={{ border: 'none' }}>
          <div className="grade-formulario">
            <div className="campo">
              <label htmlFor="cliente">Cliente *</label>
              <input
                id="cliente"
                list="clientes-orcamento"
                value={dados.clienteNome}
                onChange={(e) => alterar('clienteNome', e.target.value)}
                placeholder="Escolha ou digite o nome"
              />
              <datalist id="clientes-orcamento">
                {clientes.map((c) => (
                  <option key={c.id} value={c.razaoSocial} />
                ))}
              </datalist>
            </div>
            <div className="campo">
              <label htmlFor="localObra">Obra / local</label>
              <input
                id="localObra"
                value={dados.localObra}
                onChange={(e) => alterar('localObra', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="contato">Contato</label>
              <input
                id="contato"
                value={dados.contato}
                onChange={(e) => alterar('contato', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="telefone">Telefone</label>
              <input
                id="telefone"
                type="tel"
                value={dados.telefone}
                onChange={(e) => alterar('telefone', e.target.value)}
              />
            </div>
            <div className="campo campo-largo">
              <label htmlFor="observacoes">Observações gerais</label>
              <textarea
                id="observacoes"
                rows={2}
                value={dados.observacoes}
                onChange={(e) => alterar('observacoes', e.target.value)}
              />
            </div>
            {podeVerValores && (
              <div className="campo">
                <label htmlFor="valor">Valor estimado (R$)</label>
                <input
                  id="valor"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={dados.valorEstimado}
                  onChange={(e) => alterar('valorEstimado', e.target.value)}
                />
              </div>
            )}
            <div className="campo">
              <label htmlFor="status">Situação</label>
              <select
                id="status"
                value={dados.status}
                onChange={(e) => alterar('status', e.target.value)}
              >
                {Object.entries(STATUS_ORCAMENTO).map(([valor, s]) => (
                  <option key={valor} value={valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>
      </div>

      {/* ---------- Itens do orçamento ---------- */}
      <div className="barra-acoes">
        <h2 className="subtitulo-secao" style={{ margin: 0 }}>
          Itens do orçamento ({dados.itens.length})
        </h2>
        {podeEditar && (
          <button type="button" className="botao-primario botao-acao" onClick={adicionarItem}>
            Adicionar item
          </button>
        )}
      </div>

      {dados.itens.map((item) => (
        <div key={item.id} className="cartao cartao-item-orcamento">
          <div className="cabecalho-item-orcamento">
            <strong>Item {item.sequencia}</strong>
            {podeEditar && (
              <button
                type="button"
                className="acao-excluir"
                style={{ background: 'none', border: 'none', fontSize: 13 }}
                onClick={() => setItemExcluir(item)}
              >
                Remover item
              </button>
            )}
          </div>
          <fieldset disabled={!podeEditar || salvando} style={{ border: 'none' }}>
            <div className="grade-formulario">
              <div className="campo">
                <label>Nome do item *</label>
                <input
                  value={item.nome}
                  onChange={(e) => alterarItem(item.id, 'nome', e.target.value)}
                  placeholder="Ex.: Tanque de armazenamento"
                />
              </div>
              <div className="campo">
                <label>Medidas</label>
                <input
                  value={item.medidas}
                  onChange={(e) => alterarItem(item.id, 'medidas', e.target.value)}
                  placeholder="Ex.: 12 m diâmetro × 8 m altura ≈ 380 m²"
                />
              </div>
              <div className="campo campo-largo">
                <label>Descrição / como executar</label>
                <textarea
                  rows={2}
                  value={item.descricao}
                  onChange={(e) => alterarItem(item.id, 'descricao', e.target.value)}
                  placeholder="Observações e ideia de execução deste item"
                />
              </div>
            </div>
          </fieldset>
          {blocoAnexos(item.id, item.anexos || [])}
          {(item.anexos || []).length === 0 && (!envio || envio.itemId !== item.id) && (
            <p className="texto-apoio">Sem anexos neste item — grave um áudio ou tire fotos.</p>
          )}
        </div>
      ))}

      {dados.itens.length === 0 && (
        <div className="cartao" style={{ marginBottom: 16 }}>
          <p className="texto-apoio">
            Nenhum item ainda. Use "Adicionar item" para lançar cada peça ou serviço do
            orçamento, com fotos, áudios e arquivos próprios.
          </p>
        </div>
      )}

      {/* Anexos gerais de orçamentos antigos (antes da organização por item) */}
      {(dados.anexos || []).length > 0 && (
        <div className="cartao" style={{ marginBottom: 16 }}>
          <h2 className="subtitulo-secao" style={{ marginTop: 0 }}>
            Anexos gerais (antigos)
          </h2>
          {blocoAnexos(null, dados.anexos)}
        </div>
      )}

      {/* ---------- Lembretes ---------- */}
      <div className="cartao" style={{ marginBottom: 16 }}>
        <h2 className="subtitulo-secao" style={{ marginTop: 0 }}>
          Lembretes
        </h2>
        {dados.lembretes.map((lembrete) => (
          <div key={lembrete.id} className="linha-lembrete">
            <label className={lembrete.feito ? 'lembrete-feito' : ''}>
              <input
                type="checkbox"
                checked={lembrete.feito}
                onChange={() => alternarLembrete(lembrete.id)}
                disabled={!podeEditar}
              />
              {lembrete.texto}
            </label>
            {podeEditar && (
              <button
                type="button"
                className="acao-excluir"
                onClick={() => removerLembrete(lembrete.id)}
              >
                Remover
              </button>
            )}
          </div>
        ))}
        {dados.lembretes.length === 0 && (
          <p className="texto-apoio">Nenhum lembrete. Anote aqui o que não pode esquecer.</p>
        )}
        {podeEditar && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              style={{ flex: 1, minHeight: 44, padding: '10px 12px', border: '1px solid var(--cinza-borda)', borderRadius: 4 }}
              placeholder="Ex.: confirmar voltagem disponível no local"
              value={novoLembrete}
              onChange={(e) => setNovoLembrete(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarLembrete()}
            />
            <button type="button" className="botao-secundario" onClick={adicionarLembrete}>
              Adicionar
            </button>
          </div>
        )}
      </div>

      <div className="rodape-totais">
        <div className="resumo-totais">
          <span>
            Itens: <strong>{dados.itens.length}</strong>
          </span>
          <span>
            Anexos: <strong>{totalAnexos}</strong>
          </span>
          <span>
            Lembretes pendentes:{' '}
            <strong>{dados.lembretes.filter((l) => !l.feito).length}</strong>
          </span>
        </div>
        {podeEditar && (
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={aoSalvar}
            disabled={salvando || Boolean(envio)}
          >
            {salvando ? 'Salvando...' : dados.numero ? 'Salvar orçamento' : 'Criar orçamento'}
          </button>
        )}
      </div>

      {fotoAmpliada && (
        <div className="foto-ampliada" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="Foto ampliada" />
        </div>
      )}

      {anexoExcluir && (
        <Confirmacao
          mensagem={`Remover ${ROTULO_TIPO[anexoExcluir.anexo.tipo].toLowerCase()} "${
            anexoExcluir.anexo.nome || ''
          }"? O arquivo será apagado do armazenamento.`}
          rotuloConfirmar="Remover anexo"
          onConfirmar={confirmarExclusaoAnexo}
          onCancelar={() => setAnexoExcluir(null)}
        />
      )}

      {itemExcluir && (
        <Confirmacao
          mensagem={`Remover o item ${itemExcluir.sequencia} — "${
            itemExcluir.nome || 'sem nome'
          }" e todos os seus anexos? Esta ação não pode ser desfeita.`}
          rotuloConfirmar="Remover item"
          onConfirmar={confirmarExclusaoItem}
          onCancelar={() => setItemExcluir(null)}
        />
      )}
    </div>
  );
}
