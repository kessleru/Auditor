import { describe, expect, it } from 'vitest';
import { updateRouteSchema } from './routes.js';

describe('updateRouteSchema', () => {
  it('aceita confirmar com função', () => {
    expect(
      updateRouteSchema.safeParse({ status: 'confirmed', functionKey: 'library' }).success,
    ).toBe(true);
  });

  it('exige motivo para excluir', () => {
    expect(updateRouteSchema.safeParse({ status: 'excluded' }).success).toBe(false);
    expect(
      updateRouteSchema.safeParse({ status: 'excluded', exclusionReason: 'Página duplicada' })
        .success,
    ).toBe(true);
  });

  it('não aceita motivo sem excluir, nem corpo vazio, nem status autenticado', () => {
    expect(updateRouteSchema.safeParse({ exclusionReason: 'x y z' }).success).toBe(false);
    expect(updateRouteSchema.safeParse({}).success).toBe(false);
    expect(updateRouteSchema.safeParse({ status: 'authenticated' }).success).toBe(false);
  });
});
