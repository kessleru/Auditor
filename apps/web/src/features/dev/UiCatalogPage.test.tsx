import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { renderRoute, stubApi } from '../../test/render';

// Critério de aceite da Fase 5: o catálogo /dev/ui não tem violações no axe.
// (O contraste, que o jsdom não calcula, é verificado no navegador real.)
describe('/dev/ui', () => {
  it('renderiza o catálogo sem violações de acessibilidade', async () => {
    stubApi();
    const { container } = renderRoute('/dev/ui');
    await screen.findByRole('heading', { level: 1, name: 'Catálogo de componentes' });
    expect(screen.getAllByRole('meter')).toHaveLength(6);
    await expectNoAxeViolations(container);
  });
});
