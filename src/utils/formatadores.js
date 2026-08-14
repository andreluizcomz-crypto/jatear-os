import { somenteDigitos } from './validadores';

// Máscara progressiva 00.000.000/0000-00
export function formatarCnpj(valor) {
  const d = somenteDigitos(valor).slice(0, 14);
  let resultado = d;
  if (d.length > 2) resultado = d.slice(0, 2) + '.' + d.slice(2);
  if (d.length > 5) resultado = resultado.slice(0, 6) + '.' + d.slice(5);
  if (d.length > 8) resultado = resultado.slice(0, 10) + '/' + d.slice(8);
  if (d.length > 12) resultado = resultado.slice(0, 15) + '-' + d.slice(12);
  return resultado;
}

export function formatarMoeda(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// Aceita Timestamp do Firestore ou Date
export function formatarData(valor) {
  if (!valor) return '';
  const data = typeof valor.toDate === 'function' ? valor.toDate() : valor;
  return data.toLocaleDateString('pt-BR');
}

export const UNIDADES = [
  { valor: 'm2', rotulo: 'm²' },
  { valor: 'kg', rotulo: 'kg' },
  { valor: 'peca', rotulo: 'peça' },
  { valor: 'hora', rotulo: 'hora' },
  { valor: 'verba', rotulo: 'verba' },
];

export function rotuloUnidade(valor) {
  const unidade = UNIDADES.find((u) => u.valor === valor);
  return unidade ? unidade.rotulo : valor || '';
}
