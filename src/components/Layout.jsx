import { NavLink, Outlet } from 'react-router-dom';
import LogoJatear from '../assets/LogoJatear';
import IndicadorConexao from './IndicadorConexao';
import {
  IconeInicio,
  IconeOS,
  IconeItens,
  IconeFaturamento,
  IconeMenu,
} from './Icones';

const destinos = [
  { para: '/', rotulo: 'Início', Icone: IconeInicio },
  { para: '/ordens', rotulo: 'OS', Icone: IconeOS },
  { para: '/itens', rotulo: 'Itens', Icone: IconeItens },
  { para: '/faturamentos', rotulo: 'Faturamento', Icone: IconeFaturamento },
  { para: '/menu', rotulo: 'Menu', Icone: IconeMenu },
];

function classeNav({ isActive }) {
  return isActive ? 'ativo' : '';
}

export default function Layout() {
  return (
    <div className="layout">
      <header className="barra-superior">
        <LogoJatear altura={36} variante="branca" />
        <nav className="nav-desktop">
          {destinos.map(({ para, rotulo }) => (
            <NavLink key={para} to={para} end={para === '/'} className={classeNav}>
              {rotulo}
            </NavLink>
          ))}
        </nav>
      </header>

      <IndicadorConexao />

      <main className="conteudo">
        <Outlet />
      </main>

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
