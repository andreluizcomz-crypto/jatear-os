import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RotaProtegida from './components/RotaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login/Login';
import Inicio from './pages/Inicio/Inicio';
import OrdensServico from './pages/OrdensServico/OrdensServico';
import OSForm from './pages/OrdensServico/OSForm';
import Itens from './pages/Itens/Itens';
import Faturamentos from './pages/Faturamentos/Faturamentos';
import FaturamentoDetalhe from './pages/Faturamentos/FaturamentoDetalhe';
import GerarFaturamento from './pages/Faturamentos/GerarFaturamento';
import Menu from './pages/Menu/Menu';
import Clientes from './pages/Clientes/Clientes';
import ClienteForm from './pages/Clientes/ClienteForm';
import Servicos from './pages/Servicos/Servicos';
import Logs from './pages/Administracao/Logs';
import Usuarios from './pages/Administracao/Usuarios';
import Orcamentos from './pages/Orcamentos/Orcamentos';
import OrcamentoForm from './pages/Orcamentos/OrcamentoForm';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route path="/" element={<Inicio />} />
            <Route path="/ordens" element={<OrdensServico />} />
            <Route path="/ordens/nova" element={<OSForm />} />
            <Route path="/ordens/:id" element={<OSForm />} />
            <Route path="/itens" element={<Itens />} />
            <Route path="/faturamentos" element={<Faturamentos />} />
            <Route path="/faturamentos/gerar" element={<GerarFaturamento />} />
            <Route path="/faturamentos/:id" element={<FaturamentoDetalhe />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/clientes/novo" element={<ClienteForm />} />
            <Route path="/clientes/:id" element={<ClienteForm />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/orcamentos" element={<Orcamentos />} />
            <Route path="/orcamentos/novo" element={<OrcamentoForm />} />
            <Route path="/orcamentos/:id" element={<OrcamentoForm />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
