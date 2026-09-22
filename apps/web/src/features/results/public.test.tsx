import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { publicRoutes } from '../../test/fixtures';
import { renderRoute, stubApi } from '../../test/render';

beforeEach(() => {
  stubApi(null, { routes: publicRoutes });
});

describe('visão pública (0.2)', () => {
  it('lista as instituições; sem dado não é 0%', async () => {
    const { container } = renderRoute('/');
    const table = await screen.findByRole('table', {
      name: 'Conformidade e problemas confirmados por instituição',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    expect(
      within(rows[0]!)
        .getByRole('meter', { name: 'Conformidade do IFTM' })
        .getAttribute('aria-valuenow'),
    ).toBe('78');
    expect(rows[0]!.textContent).toContain('validação em andamento');
    expect(rows[1]!.textContent).toContain('Sem dado');
    expect(rows[1]!.textContent).not.toContain('0%');
    expect(rows[2]!.textContent).toContain('Ainda não avaliado');

    expect(screen.getByRole('link', { name: 'Abrir relatório do IFTM' }).getAttribute('href')).toBe(
      '/instituicoes/1',
    );
    expect(screen.getByText('Última coleta').nextElementSibling?.textContent).toBe('12/09/2026');
    expect(screen.getByText('Portais avaliados').nextElementSibling?.textContent).toBe('1 de 3');
    expect(screen.getByRole('link', { name: 'Entenda a metodologia' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('erro da API vira mensagem com tentar novamente', async () => {
    stubApi(null, {
      routes: {
        ...publicRoutes,
        'GET /public/institutions': () =>
          Response.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } },
            { status: 500 },
          ),
      },
    });
    renderRoute('/');
    expect(
      await screen.findByRole('heading', { name: 'Não foi possível carregar os resultados' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
  });
});

describe('/instituicoes', () => {
  it('filtra por nome ou sigla, sem acento', async () => {
    renderRoute('/instituicoes');
    await screen.findByRole('table');
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Buscar instituição' }),
      'triangulo',
    );
    expect(await screen.findByText('1 instituição')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir relatório do IFTM' })).toBeTruthy();

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(
      await screen.findByRole('heading', { name: 'Nenhuma instituição encontrada' }),
    ).toBeTruthy();
  });
});

describe('detalhe da instituição (4.3, leitura)', () => {
  it('mostra indicadores, evolução com tabela e problemas confirmados', async () => {
    const { container } = renderRoute('/instituicoes/1');
    await screen.findByRole('heading', {
      level: 1,
      name: 'Instituto Federal do Triângulo Mineiro',
    });
    expect(screen.getByRole('navigation', { name: 'Trilha de navegação' }).textContent).toContain(
      'IFTM',
    );
    expect(
      screen.getByRole('meter', { name: 'Conformidade do IFTM' }).getAttribute('aria-valuetext'),
    ).toBe('78%, Bom');
    expect(screen.getByText('Ainda fora da lista de problemas')).toBeTruthy();

    const chart = screen.getByRole('img', { name: /Conformidade por coleta/ });
    expect(chart.getAttribute('aria-label')).toBe(
      'Conformidade por coleta — mar/26: 62%; jun/26: sem dado; set/26: 78%',
    );
    const historyTable = screen.getByRole('table', { name: 'Conformidade por coleta' });
    expect(within(historyTable).getAllByRole('row')).toHaveLength(4);

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('Template')).toBeTruthy();
    expect(within(cards[0]!).getByText('em 4 páginas, 4 ocorrências')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('filtra os problemas com botões de alternância', async () => {
    renderRoute('/instituicoes/1');
    await screen.findAllByRole('article');
    const critical = screen.getByRole('button', { name: 'Somente críticos (1)' });
    await userEvent.click(critical);
    expect(critical.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('1 problema exibido')).toBeTruthy();
  });

  it('portal sem dado explica a ausência de dado', async () => {
    renderRoute('/instituicoes/2');
    expect(await screen.findByRole('heading', { name: 'Sem dado na última coleta' })).toBeTruthy();
    expect(screen.queryByText(/0%/)).toBeNull();
    expect(screen.queryByRole('article')).toBeNull();
  });
});

describe('/metodologia', () => {
  it('mostra fórmula, limites e versões da última coleta', async () => {
    const { container } = renderRoute('/metodologia');
    await screen.findByText('4.13.0');
    expect(screen.getByText('Chromium 153.0.8010.12')).toBeTruthy();
    expect(screen.getByText('12/09/2026')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'O que a nota não mede' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'pesquisa@example.org' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});
