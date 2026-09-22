import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';
import { safeReturnPath } from './LoginPage';

const auditor = { id: 1, email: 'auditora@iftm.edu.br', name: 'Auditora' };

describe('LoginPage', () => {
  it('tem um único h1, rótulos visíveis e nenhuma violação', async () => {
    stubApi(null, { routes: publicRoutes });
    const { container } = renderRoute('/entrar');
    await screen.findByRole('heading', { level: 1, name: 'Entrar como auditor' });
    expect(screen.getByLabelText('E-mail institucional')).toBeTruthy();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
    expect(document.title).toBe('Entrar como auditor · Auditoria RF');
    expect(await screen.findByRole('link', { name: 'responsável pela pesquisa' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('valida os campos antes de enviar', async () => {
    const fetchMock = stubApi(null, { routes: publicRoutes });
    renderRoute('/entrar');
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));

    const email = screen.getByLabelText('E-mail institucional');
    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/login'))).toBe(false);
  });

  it('mostra e oculta a senha', async () => {
    stubApi(null, { routes: publicRoutes });
    renderRoute('/entrar');
    const password = await screen.findByLabelText('Senha');
    expect(password.getAttribute('type')).toBe('password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password.getAttribute('type')).toBe('text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password.getAttribute('type')).toBe('password');
  });

  it('credenciais erradas: mensagem da API anunciada e focada', async () => {
    stubApi(null, {
      routes: {
        ...publicRoutes,
        'POST /auth/login': () =>
          Response.json(
            { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' } },
            { status: 401 },
          ),
      },
    });
    renderRoute('/entrar');
    await userEvent.type(
      await screen.findByLabelText('E-mail institucional'),
      'auditora@iftm.edu.br',
    );
    await userEvent.type(screen.getByLabelText('Senha'), 'errada-123456');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('E-mail ou senha incorretos.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it('entra e volta para o destino pedido', async () => {
    let body: unknown;
    stubApi(null, {
      routes: {
        ...publicRoutes,
        'POST /auth/login': (init: RequestInit | undefined) => {
          body = JSON.parse(String(init?.body));
          return Response.json({ user: auditor });
        },
      },
    });
    const { router } = renderRoute(`/entrar?voltar=${encodeURIComponent('/comparativo')}`);
    await userEvent.type(
      await screen.findByLabelText('E-mail institucional'),
      ' Auditora@IFTM.edu.br ',
    );
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-bem-longa-123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/comparativo'));
    expect(body).toEqual({ email: 'auditora@iftm.edu.br', password: 'senha-bem-longa-123' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Comparativo' })).toBeTruthy();
  });

  it('já logado, vai direto para o painel', async () => {
    stubApi(auditor, { routes: publicRoutes });
    const { router } = renderRoute('/entrar');
    await waitFor(() => expect(router.state.location.pathname).toBe('/painel'));
  });
});

describe('safeReturnPath', () => {
  it.each([
    ['/coletas/1', '/coletas/1'],
    [null, '/painel'],
    ['https://malicioso.com', '/painel'],
    ['//malicioso.com', '/painel'],
  ])('%s → %s', (input, expected) => {
    expect(safeReturnPath(input)).toBe(expected);
  });
});
