// Compressão de foto no cliente antes do upload (especificação 13.5):
// redimensiona para no máximo 1600 px no lado maior e exporta JPEG 0,8.
export function comprimirImagem(arquivo, ladoMaximo = 1600, qualidade = 0.8) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
      const largura = Math.round(imagem.width * escala);
      const altura = Math.round(imagem.height * escala);
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      tela.getContext('2d').drawImage(imagem, 0, 0, largura, altura);
      tela.toBlob(
        (blob) => (blob ? resolver(blob) : rejeitar(new Error('falha-compressao'))),
        'image/jpeg',
        qualidade
      );
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error('imagem-invalida'));
    };
    imagem.src = url;
  });
}
