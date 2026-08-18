import { NavLink, Outlet } from 'react-router-dom';
import LogoJatear from '../assets/LogoJatear';
import IndicadorConexao from './IndicadorConexao';
import { useAuth } from '../contexts/AuthContext';
import {
  IconeFaturamento,
  IconeInicio,
  IconeItens,
  IconeMenu,
  IconeOrcamento,
  IconeOS,
  IconeSair,
} from './Icones';

// Navegação inferior do celular — no máximo 5 destinos (especificação 13.4)
const destinos = [
  { para: '/', rotulo: 'Início', Icone: IconeInicio },
  { para: '/ordens', rotulo: 'OS', Icone: IconeOS },
  { para: '/itens', rotulo: 'Itens', Icone: IconeItens },
  { para: '/faturamentos', rotulo: 'Faturamento', Icone: IconeFaturamento },
  { para: '/menu', rotulo: 'Menu', Icone: IconeMenu },
];

// Sidebar do desktop — mesmo padrão visual do LMS
const grupoPrincipal = [
  { para: '/', rotulo: 'Início', Icone: IconeInicio },
  { para: '/orcamentos', rotulo: 'Orçamentos', Icone: IconeOrcamento },
  { para: '/ordens', rotulo: 'Ordens de Serviço', Icone: IconeOS },
  { para: '/itens', rotulo: 'Consulta de Itens', Icone: IconeItens },
  { para: '/faturamentos', rotulo: 'Faturamento', Icone: IconeFaturamento },
];

const grupoCadastros = [
  { para: '/clientes', rotulo: 'Clientes', Icone: IconeOS },
  { para: '/servicos', rotulo: 'Serviços', Icone: IconeItens },
];

const grupoAdministracao = [
  { para: '/usuarios', rotulo: 'Usuários e perfis', Icone: IconeItens },
  { para: '/logs', rotulo: 'Logs de auditoria', Icone: IconeOS },
];

function classeNav({ isActive }) {
  return isActive ? 'ativo' : '';
}

function classeItemMenu({ isActive }) {
  return isActive ? 'item-menu-lateral ativo' : 'item-menu-lateral';
}

function LinksGrupo({ titulo, itens }) {
  return (
    <>
      <div className="titulo-grupo-menu">{titulo}</div>
      {itens.map(({ para, rotulo, Icone }) => (
        <NavLink key={para} to={para} end={para === '/'} className={classeItemMenu}>
          <Icone width={18} height={18} />
          {rotulo}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout() {
  const { usuario, perfilUsuario, ehAdministrador, sair } = useAuth();

  return (
    <div className="layout">
      {/* Barra superior — apenas no celular */}
      <header className="barra-superior">
        <LogoJatear altura={36} variante="branca" />
      </header>

      {/* Sidebar — apenas no desktop */}
      <aside className="menu-lateral">
        <div className="logo-menu">
          <LogoJatear altura={34} variante="branca" />
        </div>
        <nav className="corpo-menu">
          <LinksGrupo titulo="Principal" itens={grupoPrincipal} />
          <LinksGrupo titulo="Cadastros" itens={grupoCadastros} />
          {ehAdministrador && (
            <LinksGrupo titulo="Administração" itens={grupoAdministracao} />
          )}
        </nav>
        <div className="rodape-menu-lateral">
          <NavLink to="/menu" className="usuario-menu" title="Minha conta">
            <span className="nome-usuario-menu">
              {perfilUsuario?.nome || usuario?.email}
            </span>
            {perfilUsuario?.perfil && (
              <span className="perfil-usuario-menu">{perfilUsuario.perfil}</span>
            )}
          </NavLink>
          <button type="button" onClick={sair} title="Sair do sistema" className="botao-sair-menu">
            <IconeSair width={16} height={16} />
          </button>
        </div>
      </aside>

      <IndicadorConexao />

      <main className="conteudo">
        <Outlet />
      </main>

      {/* Navegação inferior — apenas no celular */}
      <nav className="nav-inferior">
        {destinos.map(({ para, rotulo, Icone }) => (
          <NavLink key={para} to={para} end={para === '/'} className={classeNav}>
            <Icone width={22} height={22} />
            <span>{rotulo}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
