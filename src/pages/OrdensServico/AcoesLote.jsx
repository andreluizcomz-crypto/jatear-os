import { useState } from 'react';
import { STATUS_ITEM } from '../../utils/constantes';

// Barra de ações em lote sobre os itens selecionados na grade
export default function AcoesLote({ quantidade, servicos, onAplicar, onLimpar }) {
  const [status, setStatus] = useState('em_execucao');
  const [dataConclusao, setDataConclusao] = useState('');
  const [dataPrevista, setDataPrevista] = useState('');
  const [servicoCodigo, setServicoCodigo] = useState('');
  const [preco, setPreco] = useState('');
  const [observacao, setObservacao] = useState('');

  return (
    <div className="acoes-lote">
      <strong>{quantidade} selecionado(s)</strong>

      <div className="grupo-lote">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(STATUS_ITEM)
            .filter(([chave]) => chave !== 'faturado')
            .map(([chave, s]) => (
              <option key={chave} value={chave}>
                {s.rotulo}
              </option>
            ))}
        </select>
        <button type="button" onClick={() => onAplicar('status', status)}>
          Alterar status
        </button>
      </div>

      <div className="grupo-lote">
        <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} />
        <button type="button" onClick={() => dataConclusao && onAplicar('dataConclusao', dataConclusao)}>
          Data de conclusão
        </button>
      </div>

      <div className="grupo-lote">
        <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
        <button type="button" onClick={() => dataPrevista && onAplicar('dataPrevista', dataPrevista)}>
          Prev. de entrega
        </button>
      </div>

      <div className="grupo-lote">
        <select value={servicoCodigo} onChange={(e) => setServicoCodigo(e.target.value)}>
          <option value="">Serviço...</option>
          {servicos.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.codigo}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => servicoCodigo && onAplicar('servico', servicoCodigo)}>
          Aplicar serviço
        </button>
      </div>

      <div className="grupo-lote">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="Preço"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
        />
        <button type="button" onClick={() => preco !== '' && onAplicar('preco', preco)}>
          Aplicar preço
        </button>
      </div>

      <div className="grupo-lote">
        <input
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <button type="button" onClick={() => onAplicar('observacao', observacao)}>
          Aplicar observação
        </button>
      </div>

      <button type="button" className="limpar-selecao" onClick={onLimpar}>
        Limpar seleção
      </button>
    </div>
  );
}
