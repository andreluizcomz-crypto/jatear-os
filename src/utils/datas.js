import { Timestamp } from 'firebase/firestore';

// Data de hoje no formato do input type="date" (AAAA-MM-DD), no fuso local
export function hojeInput() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function somarDias(dataInput, dias) {
  const data = new Date(dataInput + 'T12:00:00Z');
  data.setUTCDate(data.getUTCDate() + (Number(dias) || 0));
  return data.toISOString().slice(0, 10);
}

// Timestamp do Firestore -> valor de input type="date"
export function dataParaInput(valor) {
  if (!valor) return '';
  const data = typeof valor.toDate === 'function' ? valor.toDate() : valor;
  return data.toISOString().slice(0, 10);
}

// Valor de input type="date" -> Timestamp (meio-dia UTC evita virada de fuso)
export function inputParaTimestamp(valor) {
  return valor ? Timestamp.fromDate(new Date(valor + 'T12:00:00Z')) : null;
}

export function inputParaDataCurta(valor) {
  if (!valor) return '';
  const [ano, mes, dia] = valor.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}
