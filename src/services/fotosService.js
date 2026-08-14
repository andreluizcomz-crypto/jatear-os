import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';
import { storage } from '../firebase';
import { comprimirImagem } from '../utils/imagem';

// Envia foto comprimida do item. Retorna a tarefa (permite cancelar) e uma
// promessa com os dados da foto ao concluir.
export async function iniciarEnvioFoto(osId, itemId, tipo, arquivo, aoProgredir) {
  const blob = await comprimirImagem(arquivo);
  const caminho = `os/${osId}/${itemId}/${tipo}/${Date.now()}.jpg`;
  const tarefa = uploadBytesResumable(ref(storage, caminho), blob, {
    contentType: 'image/jpeg',
  });

  const promessa = new Promise((resolver, rejeitar) => {
    tarefa.on(
      'state_changed',
      (situacao) => {
        aoProgredir(Math.round((situacao.bytesTransferred / situacao.totalBytes) * 100));
      },
      rejeitar,
      async () => {
        const urlStorage = await getDownloadURL(tarefa.snapshot.ref);
        resolver({ tipo, urlStorage, caminho, enviadoEm: new Date().toISOString() });
      }
    );
  });

  return { tarefa, promessa };
}

export function excluirFoto(caminho) {
  return deleteObject(ref(storage, caminho)).catch(() => {});
}
