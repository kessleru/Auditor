import { classifyConformity, type ConformityClass } from '@auditoria-rf/contracts';

export const conformityLabels: Record<ConformityClass, string> = {
  good: 'Bom',
  partial: 'Parcial',
  critical: 'Crítico',
};

/** 0,781 → "78%". */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function conformityLabel(value: number): string {
  return conformityLabels[classifyConformity(value)];
}
