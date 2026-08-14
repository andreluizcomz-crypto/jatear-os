import { useEffect, useState } from 'react';

// Faixa "sem conexão" na barra superior; as gravações ficam em fila
// no cache offline do Firestore até o sinal voltar.
export default function IndicadorConexao() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const aoConectar = () => setOnline(true);
    const aoDesconectar = () => setOnline(false);
    window.addEventListener('online', aoConectar);
    window.addEventListener('offline', aoDesconectar);
    return () => {
      window.removeEventListener('online', aoConectar);
      window.removeEventListener('offline', aoDesconectar);
    };
  }, []);

  if (online) return null;

  return (
    <div className="banner-offline">
      Sem conexão — as alterações serão enviadas quando o sinal voltar.
    </div>
  );
}
