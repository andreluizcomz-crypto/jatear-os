/*
  Ícones SVG lineares do sistema — traço uniforme, sem preenchimento.
  Herdam a cor do texto (currentColor).
*/
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconeInicio(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function IconeOS(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 2h8l4 4v16H7z" />
      <path d="M15 2v4h4" />
      <path d="M10 12h6M10 16h6" />
    </svg>
  );
}

export function IconeItens(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  );
}

export function IconeFaturamento(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11" />
      <path d="M15 8.8c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3 6 1.7 6 4.7 0 1.4-1.3 2.3-3 2.3-1.3 0-2.4-.5-3-1.5" />
    </svg>
  );
}

export function IconeMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconeOrcamento(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3h8v4H8z" />
      <path d="M16 4h3v18H5V4h3" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

export function IconeSair(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
