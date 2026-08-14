import { formatarMoeda } from './formatadores';

// Bibliotecas carregadas sob demanda para não pesar o carregamento inicial
async function bibliotecas() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { JsPDF, autoTable };
}

const VERMELHO = [181, 16, 19];
const CINZA = [85, 85, 85];

function desenharCabecalho(doc, titulo, subtitulo) {
  // Logomarca vetorial: círculo vermelho com J branco + JATEAR
  doc.setFillColor(...VERMELHO);
  doc.circle(20, 18, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('J', 20, 20.5, { align: 'center' });

  doc.setTextColor(...VERMELHO);
  doc.setFontSize(18);
  doc.text('JATEAR', 31, 17);
  doc.setTextColor(...CINZA);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('TRATAMENTO ANTICORROSIVO LTDA', 31, 22);

  const larguraPagina = doc.internal.pageSize.getWidth();
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titulo, larguraPagina - 14, 15, { align: 'right' });
  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(subtitulo, larguraPagina - 14, 21, { align: 'right' });
  }
  doc.setDrawColor(...VERMELHO);
  doc.setLineWidth(0.6);
  doc.line(14, 28, larguraPagina - 14, 28);
  return 34; // Y inicial do conteúdo
}

function desenharRodape(doc) {
  const paginas = doc.getNumberOfPages();
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.3);
    doc.line(14, alturaPagina - 12, larguraPagina - 14, alturaPagina - 12);
    doc.setTextColor(...CINZA);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      'www.jatear.com | jatear@jatear.com | (31) 3852-5462',
      larguraPagina / 2,
      alturaPagina - 7,
      { align: 'center' }
    );
    doc.text(`Página ${i} de ${paginas}`, larguraPagina - 14, alturaPagina - 7, {
      align: 'right',
    });
  }
}

const ESTILO_TABELA = {
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5 },
  headStyles: { fillColor: VERMELHO, textColor: 255, fontStyle: 'bold' },
  alternateRowStyles: { fillColor: [245, 245, 245] },
  margin: { left: 14, right: 14, bottom: 16 },
};

export async function montarPdf(titulo, subtitulo, montarConteudo, orientacao = 'p') {
  const { JsPDF, autoTable } = await bibliotecas();
  const doc = new JsPDF(orientacao, 'mm', 'a4');
  const yInicial = desenharCabecalho(doc, titulo, subtitulo);
  montarConteudo(doc, (opcoes) => autoTable(doc, { ...ESTILO_TABELA, ...opcoes }), yInicial);
  desenharRodape(doc);
  doc.save(`${titulo.replace(/[^\w-]+/g, '_')}.pdf`);
}

export function moedaPdf(valor) {
  return formatarMoeda(valor).replace(' ', ' ');
}
