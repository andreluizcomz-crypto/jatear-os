// Exportação CSV (separador ponto e vírgula, padrão Excel pt-BR)
export function exportarCsv(nomeArquivo, cabecalhos, linhas) {
  const escapar = (valor) => {
    const texto = String(valor ?? '');
    return /[;"\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };
  const conteudo = [
    cabecalhos.join(';'),
    ...linhas.map((linha) => linha.map(escapar).join(';')),
  ].join('\r\n');

  // BOM para o Excel reconhecer acentuação UTF-8
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeArquivo;
  ancora.click();
  URL.revokeObjectURL(url);
}
