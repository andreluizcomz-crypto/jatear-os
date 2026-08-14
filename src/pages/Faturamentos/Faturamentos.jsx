import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarFaturamentos } from '../../services/faturamentosService';
import { formatarData, formatarMoeda } from '../../utils/formatadores';

export default function Faturamentos() {
  const navegar = useNavigate();
  const [faturamentos, setFaturamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarFaturamentos()
      .then(setFaturamentos)
      .catch(() => setErro('Não foi possível carregar os faturamentos.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <div className="texto-apoio">Carregando faturamentos...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Faturamentos</h1>
      </div>
      {erro && <div className="mensagem-erro">{erro}</div>}
      <p className="texto-apoio" style={{ marginBottom: 12 }}>
        Para gerar um faturamento, selecione itens concluídos na Consulta de Itens e use
        "Gerar faturamento".
      </p>

      <div className="lista-registros">
        {faturamentos.map((fat) => (
          <button
            type="button"
            key={fat.id}
            className="linha-registro"
            onClick={() => navegar(`/faturamentos/${fat.id}`)}
          >
            <div className="linha-principal">
              <strong>
                {fat.numero} — {fat.clienteNome}
              </strong>
              <span className={fat.status === 'emitido' ? 'badge badge-ativo' : 'badge badge-inativo'}>
                {fat.status === 'emitido' ? 'Emitido' : 'Cancelado'}
              </span>
            </div>
            <div className="linha-detalhe">
              {formatarData(fat.geradoEm)} · {fat.qtdItens} item(ns) ·{' '}
              {formatarMoeda(fat.valorTotal)}
              {fat.notaFiscal && ` · NF ${fat.notaFiscal}`}
            </div>
          </button>
        ))}
        {faturamentos.length === 0 && (
          <p className="texto-apoio">Nenhum faturamento gerado ainda.</p>
        )}
      </div>
    </div>
  );
}
