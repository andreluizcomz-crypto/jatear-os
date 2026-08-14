import { montarPdf, moedaPdf } from '../utils/pdf';
import { formatarData, rotuloUnidade } from '../utils/formatadores';
import { rotuloStatusItem } from '../utils/constantes';
import { inputParaDataCurta } from '../utils/datas';

function dataCurta(valor) {
  if (!valor) return '';
  if (typeof valor === 'string') return inputParaDataCurta(valor);
  return formatarData(valor);
}

function servicosTexto(item) {
  return (item.servicos || [])
    .map(
      (s) =>
        `${s.servicoCodigo || s.codigo}: ${s.quantidadeCobrada} ${rotuloUnidade(s.unidade)} × ${moedaPdf(
          s.precoUnitario
        )}`
    )
    .join('\n');
}

// ---------- OS impressa ----------
export function gerarPdfOS(os, cliente, itens) {
  return montarPdf(`${os.numero}`, 'Ordem de Serviço', (doc, tabela, y) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const linhas = [
      `Cliente: ${os.clienteNome}` +
        (cliente?.cnpj ? `   CNPJ: ${cliente.cnpj}` : ''),
      (os.subclienteNome ? `Subcliente: ${os.subclienteNome}   ` : '') +
        (os.pedidoCompraCliente ? `Pedido de compra: ${os.pedidoCompraCliente}` : ''),
      `Abertura: ${formatarData(os.dataAbertura)}   Previsão de entrega: ${formatarData(
        os.dataPrevistaEntrega
      )}` + (os.solicitante ? `   Solicitante: ${os.solicitante}` : ''),
      os.observacoes ? `Observações: ${os.observacoes}` : '',
    ].filter(Boolean);
    linhas.forEach((linha, i) => doc.text(linha, 14, y + i * 5));

    tabela({
      startY: y + linhas.length * 5 + 3,
      head: [
        ['Seq', 'Descrição', 'Cód. peça', 'Qtd', 'Peso (kg)', 'm²', 'Serviços', 'Observações', 'Status', 'Valor'],
      ],
      body: itens.map((item) => [
        item.sequencia,
        item.descricao,
        item.codigoPeca || '',
        item.quantidade,
        item.pesoTotalKg || '',
        item.areaTotalM2 || '',
        servicosTexto(item),
        item.observacoes || '',
        rotuloStatusItem(item.status),
        moedaPdf(item.valorTotalItem),
      ]),
      columnStyles: { 1: { cellWidth: 32 }, 6: { cellWidth: 34 }, 7: { cellWidth: 30 }, 9: { halign: 'right' } },
      foot: [[
        '', 'Totais', '',
        String(itens.reduce((t, i) => t + (Number(i.quantidade) || 0), 0)),
        String(Number(itens.reduce((t, i) => t + (Number(i.pesoTotalKg) || 0), 0).toFixed(2))),
        String(Number(itens.reduce((t, i) => t + (Number(i.areaTotalM2) || 0), 0).toFixed(2))),
        '', '', '',
        moedaPdf(itens.reduce((t, i) => t + (Number(i.valorTotalItem) || 0), 0)),
      ]],
      footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
      didDrawPage: () => {},
    });

    const fimTabela = doc.lastAutoTable.finalY;
    const yAssinatura = Math.min(fimTabela + 30, doc.internal.pageSize.getHeight() - 25);
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(20, yAssinatura, 90, yAssinatura);
    doc.line(120, yAssinatura, 190, yAssinatura);
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('Jatear Tratamento Anticorrosivo', 55, yAssinatura + 4, { align: 'center' });
    doc.text('Cliente', 155, yAssinatura + 4, { align: 'center' });
  }, 'l');
}

// ---------- Romaneio de entrega ----------
export function gerarRomaneio(itens) {
  const cliente = itens[0]?.clienteNome || '';
  return montarPdf('Romaneio de entrega', cliente, (doc, tabela, y) => {
    tabela({
      startY: y,
      head: [['OS', 'Seq', 'Descrição', 'Cód. peça', 'Qtd', 'Peso (kg)']],
      body: itens.map((item) => [
        item.osNumero,
        item.sequencia,
        item.descricao,
        item.codigoPeca || '',
        item.quantidade,
        item.pesoTotalKg || '',
      ]),
      foot: [[
        '', '', 'Totais', '',
        String(itens.reduce((t, i) => t + (Number(i.quantidade) || 0), 0)),
        String(Number(itens.reduce((t, i) => t + (Number(i.pesoTotalKg) || 0), 0).toFixed(2))),
      ]],
      footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    });

    const yCampo = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(9);
    doc.text('Recebimento', 14, yCampo);
    doc.setFontSize(8);
    doc.text('Nome do recebedor: ______________________________________________', 14, yCampo + 8);
    doc.text('Documento: ____________________________   Data: ____/____/______', 14, yCampo + 16);
    doc.text('Assinatura do transportador: _____________________________________', 14, yCampo + 24);
  });
}

// ---------- Relatório de faturamento ----------
export function gerarPdfFaturamento(faturamento) {
  return montarPdf(faturamento.numero, `Faturamento — ${faturamento.clienteNome}`, (doc, tabela, y) => {
    doc.setFontSize(9);
    const info = [
      `Gerado em: ${formatarData(faturamento.geradoEm)}` +
        (faturamento.notaFiscal ? `   NF: ${faturamento.notaFiscal}` : ''),
      faturamento.periodoInicio
        ? `Período (${faturamento.criterioData}): ${formatarData(
            faturamento.periodoInicio
          )} a ${formatarData(faturamento.periodoFim)}`
        : '',
    ].filter(Boolean);
    info.forEach((linha, i) => doc.text(linha, 14, y + i * 5));

    // Agrupado por OS e subcliente (especificação 9.5)
    const grupos = new Map();
    faturamento.itens.forEach((item) => {
      const chave = `${item.osNumero} — ${item.subclienteNome || 'Sem subcliente'}`;
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(item);
    });

    let yAtual = y + info.length * 5 + 4;
    grupos.forEach((itensGrupo, titulo) => {
      tabela({
        startY: yAtual,
        head: [[{ content: titulo, colSpan: 6, styles: { fillColor: [31, 31, 31] } }],
          ['Seq', 'Descrição', 'Qtd', 'Peso (kg)', 'm²', 'Valor']],
        body: itensGrupo.map((item) => [
          item.sequencia,
          item.descricao,
          item.quantidade,
          item.pesoTotalKg || '',
          item.areaTotalM2 || '',
          moedaPdf(item.valorTotalItem),
        ]),
        foot: [[
          '', 'Subtotal',
          String(itensGrupo.reduce((t, i) => t + (Number(i.quantidade) || 0), 0)),
          String(Number(itensGrupo.reduce((t, i) => t + (Number(i.pesoTotalKg) || 0), 0).toFixed(2))),
          String(Number(itensGrupo.reduce((t, i) => t + (Number(i.areaTotalM2) || 0), 0).toFixed(2))),
          moedaPdf(itensGrupo.reduce((t, i) => t + (Number(i.valorTotalItem) || 0), 0)),
        ]],
        footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 5: { halign: 'right' } },
      });
      yAtual = doc.lastAutoTable.finalY + 4;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `Total geral: ${moedaPdf(faturamento.valorTotal)}  ·  ${faturamento.pesoTotalKg} kg  ·  ${faturamento.areaTotalM2} m²`,
      14,
      yAtual + 4
    );
  });
}

// ---------- Relatório gerencial de período ----------
export function gerarRelatorioGerencial(itens, descricaoPeriodo) {
  return montarPdf('Relatório gerencial', descricaoPeriodo, (doc, tabela, y) => {
    const agrupar = (obterChave) => {
      const mapa = new Map();
      itens.forEach((item) => {
        const chave = obterChave(item) || '(não informado)';
        if (!mapa.has(chave)) mapa.set(chave, { qtd: 0, peso: 0, area: 0, valor: 0 });
        const grupo = mapa.get(chave);
        grupo.qtd += Number(item.quantidade) || 0;
        grupo.peso += Number(item.pesoTotalKg) || 0;
        grupo.area += Number(item.areaTotalM2) || 0;
        grupo.valor += Number(item.valorTotalItem) || 0;
      });
      return [...mapa.entries()].sort((a, b) => b[1].valor - a[1].valor);
    };
    const linhaDe = ([chave, grupo]) => [
      chave,
      String(grupo.qtd),
      String(Number(grupo.peso.toFixed(2))),
      String(Number(grupo.area.toFixed(2))),
      moedaPdf(grupo.valor),
    ];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Por cliente', 14, y);
    tabela({
      startY: y + 3,
      head: [['Cliente', 'Qtd peças', 'Peso (kg)', 'Área (m²)', 'Valor']],
      body: agrupar((i) => i.clienteNome).map(linhaDe),
      columnStyles: { 4: { halign: 'right' } },
    });

    const y2 = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Por serviço', 14, y2);
    tabela({
      startY: y2 + 3,
      head: [['Serviço', 'Qtd peças', 'Peso (kg)', 'Área (m²)', 'Valor']],
      body: agrupar((i) => (i.servicos || [])[0]?.servicoCodigo).map(linhaDe),
      columnStyles: { 4: { halign: 'right' } },
    });

    const soma = (fn) => Number(itens.reduce((t, i) => t + (Number(fn(i)) || 0), 0).toFixed(2));
    const y3 = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `Total do período: ${moedaPdf(soma((i) => i.valorTotalItem))}  ·  ${soma(
        (i) => i.pesoTotalKg
      )} kg  ·  ${soma((i) => i.areaTotalM2)} m²  ·  ${itens.length} item(ns)`,
      14,
      y3
    );
  });
}
