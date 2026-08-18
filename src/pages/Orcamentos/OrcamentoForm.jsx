import { useEffect, useRef, useState } from 'react';
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
  descricao: '',
  medidas: '',
  observacoes: '',
  valorEstimado: '',
  status: 'aberto',
  lembretes: [],
  anexos: [],
};

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
  const [envio, setEnvio] = useState(null); // { tipo, progresso, tarefa }
  const [novoLembrete, setNovoLembrete] = useState('');
  const [anexoExcluir, setAnexoExcluir] = useState(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const inputsArquivo = useRef({});

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

  // ---------- Anexos ----------
  async function enviarAnexo(tipo, arquivo, nome) {
    setErro('');
    try {
      const { tarefa, promessa } = await iniciarEnvioAnexo(id, tipo, arquivo, nome, (progresso) =>
        setEnvio((atual) => ({ ...(atual || { tipo }), tipo, progresso, tarefa }))
      );
      setEnvio({ tipo, progresso: 0, tarefa });
      const anexo = await promessa;
      setDados((atual) => ({ ...atual, anexos: [...(atual.anexos || []), anexo] }));
      setEnvio(null);
      setAviso('Anexo enviado. Lembre de salvar o orçamento para gravá-lo.');
    } catch (excecao) {
      setEnvio(null);
      if (excecao?.code !== 'storage/canceled') {
        setErro('Não foi possível enviar o anexo. Verifique a conexão e tente novamente.');
      }
    }
  }

  function aoEscolherArquivo(tipo, evento) {
    const arquivo = evento.target.files[0];
    if (arquivo) enviarAnexo(tipo, arquivo, arquivo.name);
    evento.target.value = '';
  }

  function confirmarExclusaoAnexo() {
    const anexo = anexoExcluir;
    setAnexoExcluir(null);
    if (anexo.caminho) excluirAnexo(anexo.caminho);
    setDados((atual) => ({ ...atual, anexos: atual.anexos.filter((a) => a !== anexo) }));
  }

  // ---------- Salvar ----------
  async function aoSalvar() {
    setErro('');
    setAviso('');
    if (!dados.clienteNome.trim()) {
      setErro('Informe o cliente do orçamento.');
      return;
    }
    setSalvando(true);
    const corpo = {
      ...dados,
      clienteNome: dados.clienteNome.trim(),
      valorEstimado: Number(dados.valorEstimado) || 0,
    };
    delete corpo.id;
    try {
      if (ehNovo && !dados.numero) {
        const numero = await criarOrcamento(id, corpo, usuario.uid);
        setDados((atual) => ({ ...atual, numero }));
        navegar(`/orcamentos/${id}`, { replace: true });
        setAviso(`Orçamento ${numero} criado.`);
      } else {
        await atualizarOrcamento(id, corpo, usuario.uid);
        setAviso('Orçamento salvo.');
      }
    } catch (_) {
      setErro('Não foi possível salvar. Verifique sua permissão e tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando orçamento...</div>;

  const anexosPorTipo = (tipo) => (dados.anexos || []).filter((a) => a.tipo === tipo);

  return (
    <div className="pagina-os">
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{dados.numero || 'Novo orçamento'}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="botao-secundario" onClick={() => navegar('/orcamentos')}>
            Voltar
          </button>
        </div>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}
      {aviso && <div className="mensagem-sucesso">{aviso}</div>}

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
              <label htmlFor="descricao">Descrição do serviço orçado</label>
              <textarea
                id="descricao"
                rows={2}
                value={dados.descricao}
                onChange={(e) => alterar('descricao', e.target.value)}
              />
            </div>
            <div className="campo campo-largo">
              <label htmlFor="medidas">Medidas e observações técnicas</label>
              <textarea
                id="medidas"
                rows={3}
                placeholder="Ex.: tanque 12 m de diâmetro × 8 m de altura, área estimada 380 m²..."
                value={dados.medidas}
                onChange={(e) => alterar('medidas', e.target.value)}
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

      {/* ---------- Anexos ---------- */}
      <div className="cartao" style={{ marginBottom: 16 }}>
        <h2 className="subtitulo-secao" style={{ marginTop: 0 }}>
          Fotos, áudios, vídeos e arquivos
        </h2>

        {podeEditar && (
          <div className="botoes-anexo">
            <label className="botao-secundario rotulo-foto">
              Foto
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo('foto', e)}
              />
            </label>
            <GravadorAudio
              desabilitado={Boolean(envio)}
              onGravado={(blob, extensao) =>
                enviarAnexo('audio', blob, `gravacao-${Date.now()}.${extensao}`)
              }
            />
            <label className="botao-secundario rotulo-foto">
              Áudio do aparelho
              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo('audio', e)}
              />
            </label>
            <label className="botao-secundario rotulo-foto">
              Vídeo
              <input
                type="file"
                accept="video/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo('video', e)}
              />
            </label>
            <label className="botao-secundario rotulo-foto">
              Arquivo
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => aoEscolherArquivo('arquivo', e)}
              />
            </label>
          </div>
        )}

        {envio && (
          <div className="barra-progresso" style={{ marginBottom: 12 }}>
            <div className="barra-progresso-interna" style={{ width: `${envio.progresso}%` }} />
            <button type="button" className="acao-excluir" onClick={() => envio.tarefa.cancel()}>
              Cancelar envio de {ROTULO_TIPO[envio.tipo].toLowerCase()} ({envio.progresso}%)
            </button>
          </div>
        )}

        {/* Fotos em miniatura */}
        {anexosPorTipo('foto').length > 0 && (
          <div className="miniaturas" style={{ marginBottom: 12 }}>
            {anexosPorTipo('foto').map((anexo) => (
              <div key={anexo.urlStorage} className="miniatura">
                <img
                  src={anexo.urlStorage}
                  alt="Foto do orçamento"
                  onClick={() => setFotoAmpliada(anexo.urlStorage)}
                />
                {podeEditar && (
                  <button type="button" onClick={() => setAnexoExcluir(anexo)}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Áudios com player */}
        {anexosPorTipo('audio').map((anexo) => (
          <div key={anexo.urlStorage} className="linha-anexo">
            <audio controls src={anexo.urlStorage} preload="none" style={{ flex: 1, minWidth: 0 }} />
            {podeEditar && (
              <button type="button" className="acao-excluir" onClick={() => setAnexoExcluir(anexo)}>
                Remover
              </button>
            )}
          </div>
        ))}

        {/* Vídeos e arquivos como links */}
        {['video', 'arquivo'].map((tipo) =>
          anexosPorTipo(tipo).map((anexo) => (
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
                <button type="button" className="acao-excluir" onClick={() => setAnexoExcluir(anexo)}>
                  Remover
                </button>
              )}
            </div>
          ))
        )}

        {(dados.anexos || []).length === 0 && !envio && (
          <p className="texto-apoio">
            Nenhum anexo ainda. Grave um áudio com a ideia de execução, tire fotos da obra e
            anexe o que precisar.
          </p>
        )}
      </div>

      <div className="rodape-totais">
        <div className="resumo-totais">
          <span>
            Anexos: <strong>{(dados.anexos || []).length}</strong>
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
          mensagem={`Remover ${ROTULO_TIPO[anexoExcluir.tipo].toLowerCase()} "${
            anexoExcluir.nome || ''
          }"? O arquivo será apagado do armazenamento.`}
          rotuloConfirmar="Remover anexo"
          onConfirmar={confirmarExclusaoAnexo}
          onCancelar={() => setAnexoExcluir(null)}
        />
      )}
    </div>
  );
}
