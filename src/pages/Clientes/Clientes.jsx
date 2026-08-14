import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listarClientes } from '../../services/clientesService';
import { formatarCnpj } from '../../utils/formatadores';
import { somenteDigitos } from '../../utils/validadores';

export default function Clientes() {
  const { ehAdministrador } = useAuth();
  const navegar = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarClientes()
      .then(setClientes)
      .catch(() => setErro('Não foi possível carregar os clientes. Recarregue a página.'))
      .finally(() => setCarregando(false));
  }, []);

  const termo = busca.trim().toLowerCase();
  const filtrados = clientes.filter((cliente) => {
    if (!termo) return true;
    return (
      (cliente.razaoSocial || '').toLowerCase().includes(termo) ||
      (cliente.nomeFantasia || '').toLowerCase().includes(termo) ||
      somenteDigitos(cliente.cnpj).includes(somenteDigitos(termo))
    );
  });

  if (carregando) return <div className="texto-apoio">Carregando clientes...</div>;

  return (
    <div>
      <div className="barra-acoes">
        <h1 className="titulo-pagina">Clientes</h1>
        {ehAdministrador && (
          <button
            type="button"
            className="botao-primario botao-acao"
            onClick={() => navegar('/clientes/novo')}
          >
            Novo cliente
          </button>
        )}
      </div>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <div className="campo" style={{ maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Buscar por razão social ou CNPJ"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar cliente"
        />
      </div>

      <div className="lista-registros">
        {filtrados.map((cliente) => (
          <button
            type="button"
            key={cliente.id}
            className="linha-registro"
            onClick={() => navegar(`/clientes/${cliente.id}`)}
          >
            <div className="linha-principal">
              <strong>{cliente.razaoSocial}</strong>
              <span className={cliente.ativo ? 'badge badge-ativo' : 'badge badge-inativo'}>
                {cliente.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="linha-detalhe">
              {cliente.cnpj ? `CNPJ ${formatarCnpj(cliente.cnpj)}` : 'Sem CNPJ'}
              {cliente.endereco?.cidade &&
                ` · ${cliente.endereco.cidade}/${cliente.endereco.uf || ''}`}
              {(cliente.subclientes || []).length > 0 &&
                ` · ${cliente.subclientes.length} subcliente(s)`}
            </div>
          </button>
        ))}
        {filtrados.length === 0 && (
          <p className="texto-apoio">
            {clientes.length === 0
              ? 'Nenhum cliente cadastrado ainda.'
              : 'Nenhum cliente encontrado para esta busca.'}
          </p>
        )}
      </div>
    </div>
  );
}
