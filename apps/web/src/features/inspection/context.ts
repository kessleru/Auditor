import type { InspectionPortal } from '@auditoria-rf/contracts';

export interface PortalContext {
  collectionId: number;
  institutionId: number;
  portal: InspectionPortal;
}
