// Confirmação em painel deslizante (bottom sheet no celular) — nunca alert()
export default function Confirmacao({
  mensagem,
  rotuloConfirmar = 'Confirmar',
  onConfirmar,
  onCancelar,
}) {
  return (
    <div className="modal-fundo" onClick={onCancelar}>
      <div className="modal-conteudo" onClick={(e) => e.stopPropagation()}>
        <p style={{ marginBottom: 20, lineHeight: 1.5 }}>{mensagem}</p>
        <div className="acoes-modal">
          <button type="button" className="botao-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="botao-primario botao-acao" onClick={onConfirmar}>
            {rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
