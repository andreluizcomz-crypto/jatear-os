import { useState } from 'react';
import { rotuloUnidade } from '../../utils/formatadores';
import { formatarMoeda } from '../../utils/formatadores';
import {
  calcularItem,
  sugerirQuantidadeCobrada,
} from '../../services/itensService';
import { rotuloStatusItem, statusDisponiveis } from '../../utils/constantes';
import { hojeInput } from '../../utils/datas';

// Edição de item em tela cheia (celular) ou modal (desktop).
// Trabalha numa cópia local; só devolve ao salvar.
export default function ItemEditor({
  item,
  servicos,
  sugerirPreco,
  ehAdministrador,
  onSalvar,
  onFechar,
}) {
  const [dados, setDados] = useState({ ...item });
  const [erro, setErro] = useState('');
  const bloqueado = dados.faturado === true;

  function alterar(campo, valor) {
    setDados((atual) => {
      const novo = { ...atual, [campo]: valor };
      if (campo === 'status') {
        if (['concluido', 'entregue'].includes(valor) && !novo.dataConclusao) {
          novo.dataConclusao = hojeInput();
        }
        if (valor === 'entregue' && !novo.dataEntrega) {
          novo.dataEntrega = hojeInput();
        }
      }
      if (['quantidade', 'pesoUnitarioKg', 'areaUnitariaM2'].includes(campo)) {
        novo.servicos = (novo.servicos || []).map((servico) =>
          servico.qtdManual
            ? servico
            : { ...servico, quantidadeCobrada: sugerirQuantidadeCobrada(servico.unidade, novo) }
        );
      }
      return calcularItem(novo);
    });
  }

  function adicionarServico() {
    const catalogo = servicos[0];
    if (!catalogo) return;
    const novoServico = {
      servicoCodigo: catalogo.codigo,
      servicoNome: catalogo.nome,
      unidade: catalogo.unidadePadrao,
      quantidadeCobrada: sugerirQuantidadeCobrada(catalogo.unidadePadrao, dados),
      precoUnitario: sugerirPreco(catalogo.codigo),
      valor: 0,
      esquemaPintura: '',
      corRal: '',
      espessuraEspecificada: '',
      qtdManual: false,
    };
    setDados((atual) => calcularItem({ ...atual, servicos: [...(atual.servicos || []), novoServico] }));
  }

  function alterarServico(indice, campo, valor) {
    setDados((atual) => {
      const lista = (atual.servicos || []).map((servico, i) => {
        if (i !== indice) return servico;
        const novo = { ...servico, [campo]: valor };
        if (campo === 'servicoCodigo') {
          const catalogo = servicos.find((s) => s.codigo === valor);
          if (catalogo) {
            novo.servicoNome = catalogo.nome;
            novo.unidade = catalogo.unidadePadrao;
            novo.precoUnitario = sugerirPreco(catalogo.codigo);
            if (!novo.qtdManual) {
              novo.quantidadeCobrada = sugerirQuantidadeCobrada(catalogo.unidadePadrao, atual);
            }
          }
        }
        if (campo === 'unidade' && !novo.qtdManual) {
          novo.quantidadeCobrada = sugerirQuantidadeCobrada(valor, atual);
        }
        if (campo === 'quantidadeCobrada') novo.qtdManual = true;
        return novo;
      });
      return calcularItem({ ...atual, servicos: lista });
    });
  }

  function removerServico(indice) {
    setDados((atual) =>
      calcularItem({ ...atual, servicos: atual.servicos.filter((_, i) => i !== indice) })
    );
  }

  function aoSalvar() {
    if (!(dados.descricao || '').trim() || !dados.dataRecebimento) {
      setErro('Descrição e data de recebimento são obrigatórias.');
      return;
    }
    if (
      ['concluido', 'entregue'].includes(dados.status) &&
      (dados.servicos || []).length === 0
    ) {
      setErro('Item sem serviço lançado não pode ser concluído.');
      return;
    }
    if (dados.status === 'concluido' && !dados.dataConclusao) {
      setErro('Informe a data de conclusão.');
      return;
    }
    onSalvar(dados);
  }

  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className="modal-conteudo modal-item" onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo-modal">
          Item {dados.sequencia} · {rotuloStatusItem(dados.status)}
          {bloqueado && ' · bloqueado (faturado)'}
        </h2>

        {erro && <div className="mensagem-erro">{erro}</div>}

        <fieldset disabled={bloqueado} style={{ border: 'none' }}>
          <div className="grade-formulario">
            <div className="campo campo-largo">
              <label>Descrição da peça *</label>
              <input
                value={dados.descricao}
                onChange={(e) => alterar('descricao', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Código/tag da peça</label>
              <input
                value={dados.codigoPeca || ''}
                onChange={(e) => alterar('codigoPeca', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Quantidade</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={dados.quantidade}
                onChange={(e) => alterar('quantidade', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Peso unitário (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={dados.pesoUnitarioKg || ''}
                onChange={(e) => alterar('pesoUnitarioKg', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Área unitária (m²)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={dados.areaUnitariaM2 || ''}
                onChange={(e) => alterar('areaUnitariaM2', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Recebimento *</label>
              <input
                type="date"
                value={dados.dataRecebimento || ''}
                onChange={(e) => alterar('dataRecebimento', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Previsão de entrega</label>
              <input
                type="date"
                value={dados.dataPrevistaEntrega || ''}
                onChange={(e) => alterar('dataPrevistaEntrega', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Status</label>
              <select
                value={dados.status}
                onChange={(e) => alterar('status', e.target.value)}
              >
                {statusDisponiveis(dados.status, ehAdministrador)
                  .filter((s) => s !== 'cancelado' || dados.status === 'cancelado')
                  .map((s) => (
                    <option key={s} value={s}>
                      {rotuloStatusItem(s)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="campo">
              <label>Data de conclusão</label>
              <input
                type="date"
                value={dados.dataConclusao || ''}
                onChange={(e) => alterar('dataConclusao', e.target.value)}
              />
            </div>
            <div className="campo">
              <label>Data de entrega</label>
              <input
                type="date"
                value={dados.dataEntrega || ''}
                onChange={(e) => alterar('dataEntrega', e.target.value)}
              />
            </div>
            <div className="campo campo-largo">
              <label>Observações do item</label>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Especificidades desta peça (ex.: mascarar rosca, não pintar face interna)"
                value={dados.observacoes || ''}
                onChange={(e) => alterar('observacoes', e.target.value)}
              />
            </div>
          </div>

          <h3 className="subtitulo-secao">Serviços do item</h3>
          {(dados.servicos || []).map((servico, indice) => (
            <div className="cartao cartao-servico" key={indice}>
              <div className="grade-formulario">
                <div className="campo">
                  <label>Serviço</label>
                  <select
                    value={servico.servicoCodigo}
                    onChange={(e) => alterarServico(indice, 'servicoCodigo', e.target.value)}
                  >
                    {servicos.map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.codigo} — {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label>Qtd cobrada ({rotuloUnidade(servico.unidade)})</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={servico.quantidadeCobrada}
                    onChange={(e) => alterarServico(indice, 'quantidadeCobrada', e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label>Preço unitário (R$)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={servico.precoUnitario}
                    onChange={(e) => alterarServico(indice, 'precoUnitario', e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label>Valor</label>
                  <input value={formatarMoeda(servico.valor)} disabled />
                </div>
                <div className="campo">
                  <label>Esquema de pintura</label>
                  <input
                    value={servico.esquemaPintura || ''}
                    onChange={(e) => alterarServico(indice, 'esquemaPintura', e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label>Cor RAL</label>
                  <input
                    value={servico.corRal || ''}
                    onChange={(e) => alterarServico(indice, 'corRal', e.target.value)}
                  />
                </div>
                <div className="campo">
                  <label>Espessura especificada (µm)</label>
                  <input
                    value={servico.espessuraEspecificada || ''}
                    onChange={(e) =>
                      alterarServico(indice, 'espessuraEspecificada', e.target.value)
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                className="botao-remover"
                onClick={() => removerServico(indice)}
              >
                Remover serviço
              </button>
            </div>
          ))}
          <button type="button" className="botao-secundario" onClick={adicionarServico}>
            Adicionar serviço
          </button>
        </fieldset>

        <div className="rodape-item-editor">
          <strong>Total do item: {formatarMoeda(dados.valorTotalItem)}</strong>
          <div className="acoes-modal">
            <button type="button" className="botao-secundario" onClick={onFechar}>
              Cancelar
            </button>
            {!bloqueado && (
              <button type="button" className="botao-primario botao-acao" onClick={aoSalvar}>
                Aplicar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
