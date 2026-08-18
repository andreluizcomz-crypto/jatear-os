/*
  Logomarca oficial da Jatear (public/logomarca.png).
  variante "branca"   → para fundo vermelho/escuro (sidebar e barra do celular):
                        a arte vira silhueta branca via filtro CSS
  variante "colorida" → arte original, para fundo claro (tela de login)
*/
export default function LogoJatear({ altura = 36, variante = 'branca' }) {
  return (
    <img
      src="/logomarca.png"
      alt="Jatear Tratamento Anticorrosivo"
      style={{
        height: altura,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        filter: variante === 'branca' ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  );
}
