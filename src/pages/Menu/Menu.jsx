import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { IconeItens, IconeOS, IconeSair } from '../../components/Icones';

export default function Menu() {
  const { usuario, perfilUsuario, sair } = useAuth();

  return (
    <div>
      <h1 className="titulo-pagina">Menu</h1>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <p className="texto-apoio">Conectado como:</p>
        <p style={{ fontWeight: 'bold', marginTop: 4 }}>{usuario?.email}</p>
        {perfilUsuario && (
          <p className="texto-apoio" style={{ marginTop: 4 }}>
            Perfil: {perfilUsuario.perfil}
          </p>
        )}
      </div>

      <h2 className="texto-apoio" style={{ fontWeight: 'bold', marginBottom: 8 }}>
        Cadastros
      </h2>
      <div className="lista-menu" style={{ marginBottom: 16 }}>
        <Link to="/clientes">
          <IconeOS width={20} height={20} />
          Clientes
        </Link>
        <Link to="/servicos">
          <IconeItens width={20} height={20} />
          Serviços
        </Link>
      </div>

      {perfilUsuario?.perfil === 'administrador' && (
        <>
          <h2 className="texto-apoio" style={{ fontWeight: 'bold', marginBottom: 8 }}>
            Administração
          </h2>
          <div className="lista-menu" style={{ marginBottom: 16 }}>
            <Link to="/logs">
              <IconeOS width={20} height={20} />
              Logs de auditoria
            </Link>
          </div>
        </>
      )}

      <div className="cartao">
        <button
          type="button"
          className="botao-secundario"
          onClick={sair}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <IconeSair width={18} height={18} />
          Sair do sistema
        </button>
      </div>
    </div>
  );
}
