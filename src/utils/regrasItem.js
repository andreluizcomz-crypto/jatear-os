import { hojeInput } from './datas';

function paraData(valor) {
  return valor && typeof valor.toDate === 'function' ? valor.toDate() : valor || null;
}

// Item com previsão vencida e ainda não entregue/faturado (cálculo em tela)
export function itemAtrasado(item) {
  if (['entregue', 'faturado', 'cancelado'].includes(item.status)) return false;
  const prevista = paraData(item.dataPrevistaEntrega);
  if (!prevista) return false;
  return prevista < new Date(hojeInput() + 'T00:00:00');
}

// Item que não pode ser faturado por falta de preço (regra 7.3)
export function itemSemPreco(item) {
  const servicos = item.servicos || [];
  if (servicos.length === 0) return true;
  return servicos.some((s) => !(Number(s.precoUnitario) > 0));
}
