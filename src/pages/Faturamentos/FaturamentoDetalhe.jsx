import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  buscarFaturamento,
  cancelarFaturamento,
  registrarNotaFiscal,
} from '../../services/faturamentosService';
import { formatarData, formatarMoeda, rotuloUnidade } from '../../utils/formatadores';
import { dataParaInput, inputParaTimestamp } from '../../utils/datas';
import { gerarPdfFaturamento } from '../../services/pdfService';
import Justificativa from '../../components/Justificativa';

export default function FaturamentoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { usuario, ehAdministrador, perfilUsuario } = useAuth();
  const podeFaturar = ehAdministrador || perfilUsuario?.perfil === 'faturamento';

  const [faturamento, setFaturamento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [modalNF, setModalNF] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState('');
  const [dataNota, setDataNota] = useState('');
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    const registro = await buscarFaturamento(id);
    if (!registro) {
      setErro('Faturamento não encontrado.');
      return;
    }
    setFaturamento(registro);
    setNotaFiscal(registro.notaFiscal || '');
    setDataNota(dataParaInput(registro.dataNotaFiscal));
  }

  useEffect(() => {
    carregar()
      .catch(() => setErro('Não foi possível carregar o faturamento.'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvarNF() {
    setProcessando(true);
    setErro('');
    try {
      await registrarNotaFiscal(id, notaFiscal.trim(), inputParaTimestamp(dataNota), usuario.uid);
      setModalNF(false);
      setAviso('Nota fiscal registrada.');
      await carregar();
    } catch (excecao) {
      if (excecao.message === 'faturamento-cancelado') {
        setModalNF(false);
        setErro('Este faturamento foi cancelado em outra tela — a NF não foi registrada.');
        await carregar();
      } else {
        setErro('Não foi possível registrar a NF. Verifique sua permissão.');
      }
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarCancelamento(motivo) {
    setModalCancelar(false);
    setProcessando(true);
    setErro('');
    try {
      await cancelarFaturamento(id, motivo, usuario.uid);
      setAviso('Faturamento cancelado. Os itens voltaram para "concluído".');
      await carregar();
    } catch (_) {
      setErro('Não foi possível cancelar o faturamento.');
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) return <div className="texto-apoio">Carregando faturamento...</div>;
  if (!faturamento) return <div className="mensagem-erro">{erro}</div>;

  const emitido = faturamento.status === 'emitido';

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">{faturamento.numero}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="botao-secundario" onClick={() => navegar('/faturamentos')}>
            Voltar
          </button>
          <button
            type="button"
            className="botao-secundario"
            onClick={() => gerarPdfFaturamento(faturamento)}
          >
            PDF
          </button>
          {podeFaturar && emitido && (
            <>
              <button type="button" className="botao-secundario" onClick={() => setModalNF(true)}>
                Registrar NF
              </button>
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setModalCancelar(true)}
                disabled={processando}
              >
                Cancelar faturamento
              </button>
            </>
          )}
        </div>
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}
      {aviso && <div className="mensagem-sucesso">{aviso}</div>}
      {!emitido && (
        <div className="mensagem-erro">
          Faturamento cancelado
          {faturamento.motivoCancelamento && ` — motivo: ${faturamento.motivoCancelamento}`}
        </div>
      )}

      <div className="cartao" style={{ marginBottom: 16 }}>
        <div className="linha-detalhe">
          Cliente: <strong>{faturamento.clienteNome}</strong>
          {faturamento.subclienteNome && ` · Subcliente: ${faturamento.subclienteNome}`}
          <br />
          Gerado em {formatarData(faturamento.geradoEm)}
          {faturamento.periodoInicio &&
            ` · Período (${faturamento.criterioData}): ${formatarData(
              faturamento.periodoInicio
            )} a ${formatarData(faturamento.periodoFim)}`}
          {faturamento.notaFiscal && (
            <>
              <br />
              NF: <strong>{faturamento.notaFiscal}</strong>
              {faturamento.dataNotaFiscal && ` em ${formatarData(faturamento.dataNotaFiscal)}`}
            </>
          )}
        </div>
      </div>

      <div className="rolagem-horizontal">
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
              <th>Serviços</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {faturamento.itens.map((item) => (
              <tr key={`${item.osId}_${item.itemId}`}>
                <td>{item.osNumero}</td>
                <td>{item.sequencia}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 160 }}>{item.descricao}</td>
                <td>{item.subclienteNome || ''}</td>
                <td>{item.quantidade}</td>
                <td>{item.pesoTotalKg || ''}</td>
                <td>{item.areaTotalM2 || ''}</td>
                <td style={{ whiteSpace: 'normal' }}>
                  {(item.servicos || [])
                    .map(
                      (s) =>
                        `${s.codigo} ${s.quantidadeCobrada} ${rotuloUnidade(s.unidade)} × ${formatarMoeda(
                          s.precoUnitario
                        )}`
                    )
                    .join('; ')}
                </td>
                <td className="celula-valor">{formatarMoeda(item.valorTotalItem)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Totais</td>
              <td>{faturamento.itens.reduce((t, i) => t + (i.quantidade || 0), 0)}</td>
              <td>{faturamento.pesoTotalKg}</td>
              <td>{faturamento.areaTotalM2}</td>
              <td />
              <td className="celula-valor">{formatarMoeda(faturamento.valorTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {modalNF && (
        <div className="modal-fundo" onClick={() => setModalNF(false)}>
          <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
            <h2 className="titulo-modal">Registrar nota fiscal</h2>
            <div className="grade-formulario">
              <div className="campo">
                <label htmlFor="nf">Número da NF</label>
                <input id="nf" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="dataNf">Data da NF</label>
                <input
                  id="dataNf"
                  type="date"
                  value={dataNota}
                  onChange={(e) => setDataNota(e.target.value)}
                />
              </div>
            </div>
            <div className="acoes-modal">
              <button type="button" className="botao-secundario" onClick={() => setModalNF(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="botao-primario botao-acao"
                onClick={salvarNF}
                disabled={processando || !notaFiscal.trim()}
              >
                Salvar NF
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCancelar && (
        <Justificativa
          titulo={`Cancelar ${faturamento.numero}`}
          mensagem="Os itens voltarão para o status Concluído e aparecerão de novo no filtro Em aberto. O faturamento fica registrado como cancelado."
          rotuloConfirmar="Cancelar faturamento"
          onConfirmar={confirmarCancelamento}
          onCancelar={() => setModalCancelar(false)}
        />
      )}
    </div>
  );
}
