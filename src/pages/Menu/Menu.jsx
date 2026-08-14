import { useAuth } from '../../contexts/AuthContext';
import { IconeSair } from '../../components/Icones';

export default function Menu() {
  const { usuario, sair } = useAuth();

  return (
    <div>
      <h1 className="titulo-pagina">Menu</h1>

      <div className="cartao" style={{ marginBottom: 16 }}>
        <p className="texto-apoio">Conectado como:</p>
        <p style={{ fontWeight: 'bold', marginTop: 4 }}>{usuario?.email}</p>
      </div>

      <div className="cartao">
        <p className="texto-apoio" style={{ marginBottom: 16 }}>
          Cadastros, administração e relatórios serão listados aqui nas
          próximas fases.
        </p>
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
