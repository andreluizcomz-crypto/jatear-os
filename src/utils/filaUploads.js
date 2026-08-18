// Fila offline de anexos (IndexedDB): guarda o arquivo no aparelho quando
// não há internet e permite o envio automático quando a conexão volta.
const NOME_BANCO = 'jatear-os-fila';
const LOJA = 'uploads';

function abrirBanco() {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(NOME_BANCO, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(LOJA, { keyPath: 'chave' });
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

export async function adicionarNaFila(entrada) {
  const banco = await abrirBanco();
  return new Promise((resolver, rejeitar) => {
    const transacao = banco.transaction(LOJA, 'readwrite');
    transacao.objectStore(LOJA).put(entrada);
    transacao.oncomplete = () => resolver();
    transacao.onerror = () => rejeitar(transacao.error);
  });
}

export async function listarFila() {
  const banco = await abrirBanco();
  return new Promise((resolver, rejeitar) => {
    const pedido = banco.transaction(LOJA, 'readonly').objectStore(LOJA).getAll();
    pedido.onsuccess = () => resolver(pedido.result || []);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

export async function removerDaFila(chave) {
  const banco = await abrirBanco();
  return new Promise((resolver, rejeitar) => {
    const transacao = banco.transaction(LOJA, 'readwrite');
    transacao.objectStore(LOJA).delete(chave);
    transacao.oncomplete = () => resolver();
    transacao.onerror = () => rejeitar(transacao.error);
  });
}

// Pré-visualização em memória dos arquivos enfileirados nesta sessão
const previews = new Map();

export function guardarPreview(chave, blob) {
  previews.set(chave, URL.createObjectURL(blob));
}

export function obterPreview(chave) {
  return previews.get(chave) || null;
}

// Registro (localStorage) dos anexos já enviados pela fila, para substituir
// os marcadores "pendente" mesmo que a tela esteja com estado antigo.
const CHAVE_RESOLVIDOS = 'jatearos_anexos_resolvidos';

function lerResolvidos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_RESOLVIDOS) || '{}');
  } catch (_) {
    return {};
  }
}

export function registrarResolvido(chave, anexo) {
  const mapa = lerResolvidos();
  mapa[chave] = { anexo, em: Date.now() };
  // Limpeza de registros com mais de 30 dias
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  Object.keys(mapa).forEach((c) => {
    if (mapa[c].em < limite) delete mapa[c];
  });
  localStorage.setItem(CHAVE_RESOLVIDOS, JSON.stringify(mapa));
}

// Substitui marcadores pendentes pelos anexos já enviados
export function aplicarResolvidos(dados) {
  const mapa = lerResolvidos();
  const trocar = (lista) =>
    (lista || []).map((a) => (a.pendente && mapa[a.chaveFila] ? mapa[a.chaveFila].anexo : a));
  return {
    ...dados,
    anexos: trocar(dados.anexos),
    itens: (dados.itens || []).map((item) => ({ ...item, anexos: trocar(item.anexos) })),
  };
}
