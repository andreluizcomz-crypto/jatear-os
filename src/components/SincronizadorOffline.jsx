import { useEffect, useRef, useState } from 'react';
import { numerarPendentes, processarFilaUploads } from '../services/orcamentosService';
import { listarClientes } from '../services/clientesService';
import { listarServicos } from '../services/servicosService';

// Ao abrir o app e sempre que a conexão voltar, envia os arquivos
// represados no aparelho e numera os orçamentos criados sem internet.
export default function SincronizadorOffline() {
  const [mensagem, setMensagem] = useState('');
  const executando = useRef(false);

  useEffect(() => {
    let ativo = true;

    async function sincronizar() {
      if (executando.current || !navigator.onLine) return;
      executando.current = true;
      try {
        // Aquece as cópias locais dos cadastros para uso sem internet
        listarClientes().catch(() => {});
        listarServicos().catch(() => {});
        const enviados = await processarFilaUploads();
        const numerados = await numerarPendentes();
        if (ativo && (enviados > 0 || numerados > 0)) {
          const partes = [];
          if (enviados > 0) partes.push(`${enviados} arquivo(s) enviado(s)`);
          if (numerados > 0) partes.push(`${numerados} orçamento(s) numerado(s)`);
          setMensagem(`Sincronização concluída: ${partes.join(' e ')}.`);
          setTimeout(() => ativo && setMensagem(''), 6000);
        }
      } catch (_) {
        // tenta na próxima reconexão
      } finally {
        executando.current = false;
      }
    }

    sincronizar();
    window.addEventListener('online', sincronizar);
    return () => {
      ativo = false;
      window.removeEventListener('online', sincronizar);
    };
  }, []);

  if (!mensagem) return null;
  return <div className="banner-sincronizacao">{mensagem}</div>;
}
