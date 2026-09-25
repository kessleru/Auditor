import type { Institution } from '@auditoria-rf/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

const auditor = { id: 1, email: 'a@iftm.edu.br', name: 'Auditora' };
const inst = (id: number, acronym: string, name: string, domain: string): Institution => ({
  id,
  name,
  acronym,
  domain,
  active: true,
  createdAt: '2026-09-01T00:00:00.000Z',
});
const list = [
  inst(1, 'IFTM', 'Instituto Federal do Triângulo Mineiro', 'iftm.edu.br'),
  inst(2, 'IFBA', 'Instituto Federal da Bahia', 'ifba.edu.br'),
  inst(3, 'IFG', 'Instituto Federal de Goiás', 'ifg.edu.br'),
];

describe('gestão de instituições', () => {
  it('busca sem acento, edita o domínio e cadastra, com o formulário no topo', async () => {
    let patched: unknown;
    let created: unknown;
    stubApi(auditor, {
      routes: {
        ...publicRoutes,
        'GET /institutions': { institutions: list },
        'PATCH /institutions/2': (init: RequestInit | undefined) => {
          patched = JSON.parse(String(init?.body));
          return Response.json({ institution: { ...list[1], domain: 'portal.ifba.edu.br' } });
        },
        'POST /institutions': (init: RequestInit | undefined) => {
          created = JSON.parse(String(init?.body));
          return Response.json({ institution: inst(4, 'IFX', 'Instituto X', 'ifx.edu.br') });
        },
      },
    });
    const { container } = renderRoute('/gestao/instituicoes');
    await screen.findByRole('table', { name: 'Instituições cadastradas' });
    expect(screen.getByText('3 instituições')).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar instituição' }),
      'triangulo',
    );
    expect(await screen.findByText('1 de 3 instituições')).toBeTruthy();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Buscar instituição' }));

    // Editar abre o formulário preenchido e leva o foco até ele.
    await userEvent.click(await screen.findByRole('button', { name: 'Editar IFBA' }));
    const editing = screen.getByRole('region', { name: 'Editar IFBA' });
    await waitFor(() => expect(document.activeElement).toBe(within(editing).getByRole('heading')));
    const domain = within(editing).getByLabelText('Domínio') as HTMLInputElement;
    expect(domain.value).toBe('ifba.edu.br');
    await userEvent.clear(domain);
    await userEvent.type(domain, 'portal.ifba.edu.br');
    await userEvent.click(within(editing).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(patched).toMatchObject({ domain: 'portal.ifba.edu.br' }));
    expect(await screen.findByText('Alterações salvas.')).toBeTruthy();

    const open = screen.getByRole('button', { name: 'Cadastrar instituição' });
    await userEvent.click(open);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    const form = screen.getByRole('region', { name: 'Cadastrar instituição' });
    await userEvent.type(within(form).getByLabelText('Nome'), 'Instituto X');
    await userEvent.type(within(form).getByLabelText('Sigla'), 'IFX');
    await userEvent.type(within(form).getByLabelText('Domínio'), 'ifx.edu.br');
    await userEvent.click(within(form).getByRole('button', { name: 'Cadastrar' }));
    await waitFor(() =>
      expect(created).toEqual({ name: 'Instituto X', acronym: 'IFX', domain: 'ifx.edu.br' }),
    );
    // Fechado o formulário, o foco volta ao botão que o abriu.
    await waitFor(() => expect(document.activeElement).toBe(open));
  });
});
