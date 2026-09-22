import { render, screen, within } from '@testing-library/react';
import { LayoutDashboard } from 'lucide-react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import {
  Badge,
  Button,
  ConformityBar,
  DataTable,
  EmptyState,
  ErrorState,
  FindingCard,
  Logo,
  NavItem,
  PageTitle,
  SearchField,
  StatCard,
  StatGridSkeleton,
  Stepper,
  TextField,
} from './index';

describe('Button', () => {
  it('é um botão real, do tipo button por padrão, com ícone oculto', async () => {
    const { container } = render(
      <Button>
        <LayoutDashboard aria-hidden="true" />
        Painel
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Painel' });
    expect(button.getAttribute('type')).toBe('button');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    await expectNoAxeViolations(container);
  });
});

describe('Badge', () => {
  it('sempre tem texto', () => {
    render(<Badge variant="critical">Crítico</Badge>);
    expect(screen.getByText('Crítico')).toBeTruthy();
  });
});

describe('StatCard', () => {
  it('anuncia o rótulo antes do valor', async () => {
    const { container } = render(<StatCard label="Portais avaliados" value="38" />);
    const [dt, dd] = [container.querySelector('dt'), container.querySelector('dd')];
    expect(dt?.textContent).toBe('Portais avaliados');
    expect(dd?.textContent).toBe('38');
    expect(dt?.compareDocumentPosition(dd as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expectNoAxeViolations(container);
  });
});

describe('ConformityBar', () => {
  it('é um medidor com valor, texto e classificação', async () => {
    const { container } = render(<ConformityBar value={0.781} label="Conformidade do IFTM" />);
    const meter = screen.getByRole('meter', { name: 'Conformidade do IFTM' });
    expect(meter.getAttribute('aria-valuenow')).toBe('78');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
    expect(meter.getAttribute('aria-valuetext')).toBe('78%, Bom');
    expect(container.textContent).toContain('78% Bom');
    await expectNoAxeViolations(container);
  });

  it.each([
    [0.5, 'Parcial'],
    [0.49, 'Crítico'],
  ])('%d → %s', (value, label) => {
    render(<ConformityBar value={value} label="x" />);
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toContain(label);
  });

  it('ausência de dado não é 0%', () => {
    render(<ConformityBar value={null} label="Conformidade" />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('Sem dado')).toBeTruthy();
  });
});

describe('DataTable', () => {
  it('usa tabela real com legenda e cabeçalhos com escopo', async () => {
    const { container } = render(
      <DataTable
        caption="Instituições"
        captionHidden
        rows={[{ id: 1, name: 'IFTM', total: 3 }]}
        rowKey={(r) => r.id}
        columns={[
          { key: 'name', header: 'Instituição', rowHeader: true, cell: (r) => r.name },
          { key: 'total', header: 'Problemas', align: 'end', cell: (r) => r.total },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Instituições' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.getAttribute('scope')),
    ).toEqual(['col', 'col']);
    expect(within(table).getByRole('rowheader', { name: 'IFTM' }).getAttribute('scope')).toBe(
      'row',
    );
    await expectNoAxeViolations(container);
  });
});

describe('TextField e SearchField', () => {
  it('tem rótulo visível e liga dica e erro por aria-describedby', async () => {
    const { container } = render(
      <TextField
        label="E-mail"
        hint="Use o e-mail institucional."
        error="Informe um e-mail válido."
      />,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const described = (input.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['Use o e-mail institucional.', 'Informe um e-mail válido.']);
    await expectNoAxeViolations(container);
  });

  it('busca tem rótulo mesmo com placeholder', async () => {
    const { container } = render(
      <SearchField label="Buscar instituição" placeholder="Nome ou sigla" />,
    );
    expect(screen.getByRole('searchbox', { name: 'Buscar instituição' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('Stepper', () => {
  it('marca a etapa atual e diz "concluída" nas anteriores', async () => {
    const { container } = render(<Stepper current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Escopo — concluída',
      '2Revisão de rotas',
      '3Coleta',
    ]);
    expect(items[1]?.getAttribute('aria-current')).toBe('step');
    expect(items[0]?.getAttribute('aria-current')).toBeNull();
    await expectNoAxeViolations(container);
  });
});

describe('NavItem', () => {
  it('item ativo tem aria-current="page"', () => {
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <nav aria-label="Teste">
              <NavItem to="/painel" label="Painel" icon={LayoutDashboard} />
              <NavItem to="/comparativo" label="Comparativo" icon={LayoutDashboard} />
            </nav>
          ),
        },
      ],
      { initialEntries: ['/painel'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('link', { name: 'Painel' }).getAttribute('aria-current')).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Comparativo' }).getAttribute('aria-current'),
    ).toBeNull();
  });
});

describe('FindingCard, estados, logo e título', () => {
  it('não têm violações', async () => {
    const { container } = render(
      <main>
        <PageTitle>Relatório</PageTitle>
        <Logo />
        <Logo variant="compact" />
        <FindingCard
          severity="moderate"
          origin="inspection"
          wcagCriteria="2.4.4, 4.1.2"
          principle="operable"
          title="Link sem nome"
          description="O link do logotipo não tem texto."
          pageUrl="https://www.iftm.edu.br/"
          snippet="<a href='/'></a>"
          recommendation="dar um nome ao link."
          headingLevel={2}
        />
        <EmptyState title="Nada aqui" description="Sem dados." />
        <ErrorState title="Falhou" description="Tente de novo." />
      </main>,
    );
    expect(screen.getByText('Moderado')).toBeTruthy();
    expect(screen.getByText('Inspeção')).toBeTruthy();
    expect(screen.getByText('WCAG 2.4.4, 4.1.2 — operável')).toBeTruthy();
    expect(document.title).toBe('Relatório · Auditoria RF');
    await expectNoAxeViolations(container);
  });
});

describe('StatGridSkeleton', () => {
  it('é oculto para leitor de tela e anuncia o carregamento', async () => {
    const { container } = render(
      <StatGridSkeleton label="Carregando indicadores…" hints={[false, true]} />,
    );
    expect(screen.getByRole('status').textContent).toBe('Carregando indicadores…');
    expect(container.querySelectorAll('[aria-hidden="true"].rounded-lg')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });
});
