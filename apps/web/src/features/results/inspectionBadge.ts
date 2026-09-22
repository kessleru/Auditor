import type { AuditorInstitution } from '@auditoria-rf/contracts';
import type { BadgeVariant } from '../../components/ui';

/** Situação da camada manual na coleta exibida (coluna "Inspeção"). */
export function inspectionBadge(row: AuditorInstitution): { label: string; variant: BadgeVariant } {
  if (row.status === 'not_collected') return { label: 'Não coletado', variant: 'neutral' };
  if (row.status !== 'evaluated') return { label: 'Sem dado', variant: 'neutral' };
  switch (row.inspection) {
    case 'done':
      return { label: 'Concluída', variant: 'good' };
    case 'in_progress':
      return { label: 'Em andamento', variant: 'moderate' };
    case 'not_started':
      return { label: 'Pendente', variant: 'moderate' };
    default:
      return { label: 'Fora da subamostra', variant: 'neutral' };
  }
}
