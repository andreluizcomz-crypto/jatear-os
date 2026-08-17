import { somenteDigitos } from '../utils/validadores';

// Busca de endereço pelo CEP no ViaCEP (público, sem chave)
export async function buscarCep(cep) {
  const digitos = somenteDigitos(cep);
  if (digitos.length !== 8) return null;
  const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
  if (!resposta.ok) throw new Error('cep-indisponivel');
  const dados = await resposta.json();
  if (dados.erro) return null;
  return {
    logradouro: dados.logradouro || '',
    bairro: dados.bairro || '',
    cidade: dados.localidade || '',
    uf: dados.uf || '',
  };
}
