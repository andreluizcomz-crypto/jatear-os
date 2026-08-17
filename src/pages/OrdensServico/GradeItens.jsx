import { useRef } from 'react';
import { formatarMoeda } from '../../utils/formatadores';
import { inputParaDataCurta } from '../../utils/datas';
import { STATUS_ITEM, rotuloStatusItem, statusDisponiveis } from '../../utils/constantes';

function BadgeStatus({ status }) {
  return (
    <span
      className="badge"
      style={{ background: 'var(--cinza-claro)', color: STATUS_ITEM[status]?.cor || '#555' }}
    >
      {rotuloStatusItem(status)}
    </span>
  );
}

// Grade de itens: tabela editável em linha no desktop,
// lista de cartões no celular (edição em tela cheia).
export default function GradeItens({
  itens,
  servicos,
  totais,
  podeEditar,
  ehAdministrador,
  podeVerValores,
  selecionados,
  acoes,
}) {
  const inputCsv = useRef(null);

  const linhaBloqueada = (item) => item.faturado === true || !podeEditar;
  const todosSelecionados = itens.length > 0 && selecionados.size === itens.length;

  return (
    <div>
      <div className="barra-acoes" style={{ marginTop: 24 }}>
        <h2 className="subtitulo-secao" style={{ margin: 0 }}>
          Itens ({itens.length})
        </h2>
        {podeEditar && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="botao-secundario"
              onClick={() => inputCsv.current.click()}
              title="Colunas: Seq; Descrição; Cód. peça; Qtd; Peso un. (kg); Área un. (m²); Serviço; Qtd cobrada; Preço un.; Valor; Recebimento (DD/MM/AAAA); Prev. entrega; Observações"
            >
              Importar CSV
            </button>
            <button type="button" className="botao-primario botao-acao" onClick={acoes.adicionar}>
              Adicionar item
            </button>
            <input
              ref={inputCsv}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files[0]) acoes.importarCsv(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}
      </div>

      {/* ---------- Desktop: tabela editável em linha ---------- */}
      <div className="so-desktop rolagem-horizontal">
        <table className="tabela-itens">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={acoes.alternarTodos}
                  title="Selecionar todos"
                />
              </th>
              <th>Seq</th>
              <th className="col-descricao">Descrição</th>
              <th>Cód. peça</th>
              <th>Qtd</th>
              <th>Peso un. (kg)</th>
              <th>Área un. (m²)</th>
              <th>Serviço</th>
              <th>Qtd cobrada</th>
              {podeVerValores && <th>Preço un.</th>}
              {podeVerValores && <th>Valor</th>}
              <th>Recebimento</th>
              <th>Prev. entrega</th>
              <th className="col-observacoes">Observações</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, indice) => {
              const servicoPrincipal = item.servicos?.[0];
              const bloqueada = linhaBloqueada(item);
              return (
                <tr key={item.id || `novo-${indice}`} className={bloqueada ? 'linha-bloqueada' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selecionados.has(indice)}
                      onChange={() => acoes.alternarSelecionado(indice)}
                    />
                  </td>
                  <td>{item.sequencia}</td>
                  <td className="col-descricao">
                    <input
                      value={item.descricao}
                      onChange={(e) => acoes.alterarItem(indice, 'descricao', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <input
                      value={item.codigoPeca || ''}
                      onChange={(e) => acoes.alterarItem(indice, 'codigoPeca', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={item.quantidade}
                      onChange={(e) => acoes.alterarItem(indice, 'quantidade', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.pesoUnitarioKg || ''}
                      onChange={(e) => acoes.alterarItem(indice, 'pesoUnitarioKg', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.areaUnitariaM2 || ''}
                      onChange={(e) => acoes.alterarItem(indice, 'areaUnitariaM2', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <select
                        value={servicoPrincipal?.servicoCodigo || ''}
                        onChange={(e) => acoes.alterarServicoPrincipal(indice, e.target.value)}
                        disabled={bloqueada}
                      >
                        <option value="">—</option>
                        {servicos.map((s) => (
                          <option key={s.codigo} value={s.codigo}>
                            {s.codigo}
                          </option>
                        ))}
                      </select>
                      {(item.servicos?.length || 0) > 1 && (
                        <span className="badge badge-ativo" title="Item com mais de um serviço">
                          +{item.servicos.length - 1}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={servicoPrincipal?.quantidadeCobrada ?? ''}
                      onChange={(e) => acoes.alterarQtdCobrada(indice, e.target.value)}
                      disabled={bloqueada || !servicoPrincipal}
                    />
                  </td>
                  {podeVerValores && (
                    <td>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={servicoPrincipal?.precoUnitario ?? ''}
                        onChange={(e) => acoes.alterarPrecoUnitario(indice, e.target.value)}
                        disabled={bloqueada || !servicoPrincipal}
                      />
                    </td>
                  )}
                  {podeVerValores && (
                    <td className="celula-valor">{formatarMoeda(item.valorTotalItem)}</td>
                  )}
                  <td>
                    <input
                      type="date"
                      value={item.dataRecebimento || ''}
                      onChange={(e) => acoes.alterarItem(indice, 'dataRecebimento', e.target.value)}
                      disabled={bloqueada}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={item.dataPrevistaEntrega || ''}
                      onChange={(e) =>
                        acoes.alterarItem(indice, 'dataPrevistaEntrega', e.target.value)
                      }
                      disabled={bloqueada}
                    />
                  </td>
                  <td className="col-observacoes">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {item.observacoes && (
                        <span className="indicador-obs" title="Item com observações">●</span>
                      )}
                      <input
                        value={item.observacoes || ''}
                        title={item.observacoes || 'Clique em Editar para texto longo'}
                        maxLength={500}
                        onChange={(e) => acoes.alterarItem(indice, 'observacoes', e.target.value)}
                        disabled={bloqueada}
                      />
                    </div>
                  </td>
                  <td>
                    {item.faturado || !podeEditar ? (
                      <BadgeStatus status={item.status} />
                    ) : (
                      <select
                        value={item.status}
                        onChange={(e) => acoes.alterarStatus(indice, e.target.value)}
                        style={{ color: STATUS_ITEM[item.status]?.cor }}
                      >
                        {statusDisponiveis(item.status, ehAdministrador).map((s) => (
                          <option key={s} value={s}>
                            {rotuloStatusItem(s)}
                          </option>
                        ))}
                      </select>
                    )}
                    {item.faturado && (
                      <div className="linha-detalhe">Fat.: {item.faturamentoNumero || ''}</div>
                    )}
                  </td>
                  <td>
                    <div className="acoes-linha">
                      <button type="button" onClick={() => acoes.editar(indice)} title="Editar em detalhe">
                        Editar
                      </button>
                      {item.id && (
                        <button
                          type="button"
                          onClick={() => acoes.editar(indice)}
                          title="Anexar ou ver fotos do item"
                        >
                          Fotos{(item.fotos || []).length > 0 && ` (${item.fotos.length})`}
                        </button>
                      )}
                      {podeEditar && !item.faturado && (
                        <button type="button" onClick={() => acoes.duplicar(indice)} title="Duplicar linha">
                          Duplicar
                        </button>
                      )}
                      {podeEditar && !item.id && (
                        // Registro operacional salvo não é excluído (regra 7.9) —
                        // apenas itens ainda não gravados podem ser removidos
                        <button
                          type="button"
                          className="acao-excluir"
                          onClick={() => acoes.excluir(indice)}
                          title="Remover item não salvo"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={16} className="texto-apoio" style={{ padding: 16 }}>
                  Nenhum item lançado. Use "Adicionar item" ou "Importar CSV".
                </td>
              </tr>
            )}
          </tbody>
          {itens.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>Totais</td>
                <td>{totais.qtdPecas}</td>
                <td>{totais.pesoTotalKg}</td>
                <td>{totais.areaTotalM2}</td>
                <td colSpan={podeVerValores ? 3 : 2} />
                {podeVerValores && (
                  <td className="celula-valor">{formatarMoeda(totais.valorTotal)}</td>
                )}
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ---------- Celular: lista de cartões ---------- */}
      <div className="so-celular lista-registros">
        {itens.map((item, indice) => (
          <button
            type="button"
            key={item.id || `novo-${indice}`}
            className="linha-registro"
            onClick={() => acoes.editar(indice)}
          >
            <div className="linha-principal">
              <strong>
                {item.sequencia}. {item.descricao || '(sem descrição)'}
                {item.observacoes && (
                  <span className="indicador-obs" title="Item com observações">
                    {' '}●
                  </span>
                )}
              </strong>
              <BadgeStatus status={item.status} />
            </div>
            <div className="linha-detalhe">
              Qtd: {item.quantidade}
              {(item.servicos || []).length > 0 &&
                ` · ${item.servicos.map((s) => s.servicoCodigo).join(', ')}`}
              {podeVerValores && ` · ${formatarMoeda(item.valorTotalItem)}`}
              {item.dataPrevistaEntrega && ` · Prev.: ${inputParaDataCurta(item.dataPrevistaEntrega)}`}
              {(item.fotos || []).length > 0 && ` · ${item.fotos.length} foto(s)`}
            </div>
          </button>
        ))}
        {itens.length === 0 && (
          <p className="texto-apoio">Nenhum item lançado. Use "Adicionar item".</p>
        )}
        {podeEditar && (
          <button type="button" className="botao-flutuante so-celular" onClick={acoes.adicionar}>
            + Item
          </button>
        )}
      </div>
    </div>
  );
}
