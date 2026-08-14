export const STATUS_ITEM = {
  recebido: { rotulo: 'Recebido', cor: '#0277BD' },
  em_execucao: { rotulo: 'Em execução', cor: '#ED6C02' },
  concluido: { rotulo: 'Concluído', cor: '#2E7D32' },
  entregue: { rotulo: 'Entregue', cor: '#2E7D32' },
  faturado: { rotulo: 'Faturado', cor: '#1F1F1F' },
  cancelado: { rotulo: 'Cancelado', cor: '#C62828' },
};

export const STATUS_OS = {
  aberta: { rotulo: 'Aberta', cor: '#0277BD' },
  em_execucao: { rotulo: 'Em execução', cor: '#ED6C02' },
  concluida: { rotulo: 'Concluída', cor: '#2E7D32' },
  parcialmente_faturada: { rotulo: 'Parcialmente faturada', cor: '#ED6C02' },
  faturada: { rotulo: 'Faturada', cor: '#1F1F1F' },
  cancelada: { rotulo: 'Cancelada', cor: '#C62828' },
};

export function rotuloStatusItem(status) {
  return STATUS_ITEM[status]?.rotulo || status || '';
}

// Fluxo: recebido → em_execucao → concluido → entregue → faturado
// (faturado só pela rotina de faturamento; retrocesso só administrador)
const ORDEM_STATUS = ['recebido', 'em_execucao', 'concluido', 'entregue'];

export function statusDisponiveis(atual, ehAdministrador) {
  if (atual === 'faturado') return ['faturado']; // só retrocede cancelando o faturamento
  if (atual === 'cancelado') {
    return ehAdministrador ? ['cancelado', 'recebido'] : ['cancelado'];
  }
  const indiceAtual = ORDEM_STATUS.indexOf(atual);
  const opcoes = ORDEM_STATUS.filter((_, i) =>
    ehAdministrador ? true : i >= indiceAtual
  );
  return [...opcoes, 'cancelado'];
}

export function ehRetrocesso(de, para) {
  const a = ORDEM_STATUS.indexOf(de);
  const b = ORDEM_STATUS.indexOf(para);
  return a >= 0 && b >= 0 && b < a;
}

export function rotuloStatusOS(status) {
  return STATUS_OS[status]?.rotulo || status || '';
}
