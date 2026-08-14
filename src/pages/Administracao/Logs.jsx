import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function Logs() {
  const { ehAdministrador } = useAuth();
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!ehAdministrador) {
      setCarregando(false);
      return;
    }
    getDocs(query(collection(db, 'logs'), orderBy('dataHora', 'desc'), limit(200)))
      .then((resultado) => setLogs(resultado.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setErro('Não foi possível carregar os logs.'))
      .finally(() => setCarregando(false));
  }, [ehAdministrador]);

  if (!ehAdministrador) {
    return <div className="mensagem-erro">Acesso restrito ao administrador.</div>;
  }
  if (carregando) return <div className="texto-apoio">Carregando logs...</div>;

  return (
    <div>
      <h1 className="titulo-pagina">Logs de auditoria</h1>
      {erro && <div className="mensagem-erro">{erro}</div>}
      <div className="rolagem-horizontal">
        <table className="tabela-itens">
          <thead>
            <tr>
              <th>Data/hora</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Dados</th>
              <th>Usuário</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((registro) => (
              <tr key={registro.id}>
                <td>
                  {registro.dataHora?.toDate
                    ? registro.dataHora.toDate().toLocaleString('pt-BR')
                    : ''}
                </td>
                <td>{registro.acao}</td>
                <td>{registro.entidade}</td>
                <td style={{ whiteSpace: 'normal', maxWidth: 320 }}>
                  {registro.dados ? JSON.stringify(registro.dados) : ''}
                </td>
                <td>{registro.usuarioId || ''}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-apoio" style={{ padding: 16 }}>
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
