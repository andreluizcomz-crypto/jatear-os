import { useState } from 'react';

// Pedido de justificativa em painel deslizante (cancelamentos e encerramentos)
export default function Justificativa({ titulo, mensagem, rotuloConfirmar, onConfirmar, onCancelar }) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');

  function confirmar() {
    if (!texto.trim()) {
      setErro('A justificativa é obrigatória.');
      return;
    }
    onConfirmar(texto.trim());
  }

  return (
    <div className="modal-fundo" onClick={onCancelar}>
      <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
        <h2 className="titulo-modal">{titulo}</h2>
        {mensagem && <p className="texto-apoio" style={{ marginBottom: 12 }}>{mensagem}</p>}
        {erro && <div className="mensagem-erro">{erro}</div>}
        <div className="campo">
          <label htmlFor="justificativa">Justificativa *</label>
          <textarea
            id="justificativa"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="acoes-modal">
          <button type="button" className="botao-secundario" onClick={onCancelar}>
            Voltar
          </button>
          <button type="button" className="botao-primario botao-acao" onClick={confirmar}>
            {rotuloConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
