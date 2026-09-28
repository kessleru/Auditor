const TIME_ZONE = 'America/Sao_Paulo';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-09-12T..." → "12/09/2026" (horário de Brasília). */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "2026-09-12T..." → "set/26", para eixos de gráfico. */
export function formatMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: '2-digit',
    month: 'numeric',
    timeZone: TIME_ZONE,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${MONTHS[Number(parts.month) - 1]}/${parts.year}`;
}

/** 2345 (ms) → "2,3 s". */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

/** 1234 → "1.234". */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}
