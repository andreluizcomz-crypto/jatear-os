import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RotaProtegida from './components/RotaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login/Login';
import Inicio from './pages/Inicio/Inicio';
import OrdensServico from './pages/OrdensServico/OrdensServico';
import Itens from './pages/Itens/Itens';
import Faturamentos from './pages/Faturamentos/Faturamentos';
import Menu from './pages/Menu/Menu';

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
            <Route path="/itens" element={<Itens />} />
            <Route path="/faturamentos" element={<Faturamentos />} />
            <Route path="/menu" element={<Menu />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
