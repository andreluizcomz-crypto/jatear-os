/*
  Logomarca Jatear em SVG.
  variante "branca"   → para fundo vermelho/escuro (barra superior)
  variante "colorida" → para fundo claro
*/
export default function LogoJatear({ altura = 36, variante = 'branca' }) {
  const corCirculo = variante === 'branca' ? '#FFFFFF' : '#B51013';
  const corJ = variante === 'branca' ? '#B51013' : '#FFFFFF';
  const corTexto = variante === 'branca' ? '#FFFFFF' : '#B51013';
  const corSubtexto = variante === 'branca' ? '#FFFFFF' : '#1F1F1F';

  return (
    <svg
      height={altura}
      viewBox="0 0 320 64"
      role="img"
      aria-label="Jatear Tratamento Anticorrosivo"
    >
      <circle cx="30" cy="30" r="26" fill={corCirculo} />
      <text
        x="30"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="40"
        fill={corJ}
      >
        J
      </text>
      <text
        x="64"
        y="40"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="34"
        letterSpacing="1"
        fill={corTexto}
      >
        JATEAR
      </text>
      <text
        x="65"
        y="56"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="10.2"
        letterSpacing="0.6"
        fill={corSubtexto}
      >
        TRATAMENTO ANTICORROSIVO
      </text>
    </svg>
  );
}
