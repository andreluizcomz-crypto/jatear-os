import { useEffect, useRef, useState } from 'react';

// Gravação de áudio pelo microfone (MediaRecorder).
// Ao parar, entrega o blob gravado via onGravado(blob, extensao).
export default function GravadorAudio({ onGravado, desabilitado }) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState('');
  const gravador = useRef(null);
  const pedacos = useRef([]);
  const cronometro = useRef(null);

  useEffect(() => () => clearInterval(cronometro.current), []);

  async function iniciar() {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      pedacos.current = [];
      recorder.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacos.current.push(evento.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((faixa) => faixa.stop());
        const blob = new Blob(pedacos.current, { type: recorder.mimeType || 'audio/webm' });
        const extensao = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
        if (blob.size > 0) onGravado(blob, extensao);
      };
      gravador.current = recorder;
      recorder.start();
      setGravando(true);
      setSegundos(0);
      cronometro.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch (_) {
      setErro('Não foi possível acessar o microfone. Verifique a permissão do navegador.');
    }
  }

  function parar() {
    clearInterval(cronometro.current);
    setGravando(false);
    gravador.current?.stop();
  }

  const tempo = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(
    segundos % 60
  ).padStart(2, '0')}`;

  return (
    <div className="gravador-audio">
      {gravando ? (
        <button type="button" className="botao-primario botao-acao" onClick={parar}>
          Parar gravação ({tempo})
        </button>
      ) : (
        <button type="button" className="botao-secundario" onClick={iniciar} disabled={desabilitado}>
          Gravar áudio
        </button>
      )}
      {erro && <span className="dica-campo dica-erro">{erro}</span>}
    </div>
  );
}
