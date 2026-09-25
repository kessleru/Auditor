import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

beforeEach(() => {
  stubApi(
    { id: 1, email: 'auditora@iftm.edu.br', name: 'Otávio Kessler Ustra' },
    { routes: publicRoutes },
  );
});

describe('PublicLayout', () => {
  it('o primeiro elemento focável é o link para pular ao conteúdo', async () => {
    renderRoute('/');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Acessibilidade dos portais da Rede Federal',
    });
    await userEvent.tab();
    const skip = screen.getByRole('link', { name: 'Pular para o conteúdo' });
    expect(document.activeElement).toBe(skip);
    expect(skip.getAttribute('href')).toBe('#conteudo');
    expect(document.getElementById('conteudo')?.tagName).toBe('MAIN');
  });

  it('tem os marcos, um único h1 e o item atual marcado', async () => {
    const { container } = renderRoute('/metodologia');
    await screen.findByRole('heading', { level: 1, name: 'Sobre a metodologia' });
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Sobre a metodologia' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('link', { name: 'Auditoria RF — início' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('ao navegar, move o foco para o h1 e atualiza o título do documento', async () => {
    renderRoute('/');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Acessibilidade dos portais da Rede Federal',
    });
    expect(document.title).toBe('Resultados · Auditoria RF');

    await userEvent.click(screen.getByRole('link', { name: 'Sobre a metodologia' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Sobre a metodologia' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.title).toBe('Sobre a metodologia · Auditoria RF');
  });

  it('link com âncora leva o foco ao título da seção, não ao topo da página', async () => {
    renderRoute('/');
    await userEvent.click(await screen.findByRole('link', { name: 'Como a comparação é feita' }));
    const section = await screen.findByRole('heading', {
      level: 2,
      name: 'Como a comparação é feita',
    });
    await waitFor(() => expect(document.activeElement).toBe(section));
  });
});

describe('AuditorLayout', () => {
  it('mostra a navegação agrupada, o item atual e o auditor', async () => {
    const { container } = renderRoute('/painel');
    await screen.findByRole('heading', { level: 1, name: 'Painel de auditoria' });
    const nav = screen.getAllByRole('navigation', { name: 'Principal' })[0]!;
    expect(nav.textContent).toContain('Auditorias');
    expect(screen.getAllByRole('list', { name: 'Resultados' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Painel' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Otávio Kessler Ustra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('menu do celular: abre com aria-expanded, prende o foco e fecha com Esc devolvendo o foco', async () => {
    renderRoute('/painel');
    await screen.findByRole('heading', { level: 1, name: 'Painel de auditoria' });
    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const dialog = screen.getByRole('dialog', { name: 'Menu de navegação' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.getElementById('conteudo')?.hasAttribute('inert')).toBe(true);

    // Tab no último elemento volta para o primeiro (foco preso).
    const focusables = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusables[focusables.length - 1]!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(focusables[0]);

    await userEvent.keyboard('{Escape}');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(document.getElementById('conteudo')?.hasAttribute('inert')).toBe(false);
  });

  it('sair encerra a sessão e leva para a tela de entrada', async () => {
    const fetchMock = stubApi({ id: 1, email: 'a@iftm.edu.br', name: 'Auditora' });
    const { router } = renderRoute('/painel');
    await screen.findByText('Auditora');
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'));
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) => String(url).endsWith('/auth/logout') && init?.method === 'POST',
      ),
    ).toBe(true);
  });
});

describe('rotas do auditor sem sessão', () => {
  it('levam para /entrar guardando o destino', async () => {
    stubApi(null, { routes: publicRoutes });
    const { router } = renderRoute('/coletas/7?aba=paginas');
    await screen.findByRole('heading', { level: 1, name: 'Entrar como auditor' });
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toBe(
      `?voltar=${encodeURIComponent('/coletas/7?aba=paginas')}`,
    );
  });
});

describe('rota inexistente', () => {
  it('mostra a página de não encontrado', async () => {
    renderRoute('/nao-existe');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeTruthy();
  });
});
