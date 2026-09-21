import { Activity, Check, CirclePlus, Download, LayoutDashboard, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
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
  Stepper,
  TextField,
} from '../../components/ui';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-section text-text">{title}</h2>
      {children}
    </section>
  );
}

const institutions = [
  {
    acronym: 'IFTM',
    name: 'Instituto Federal do Triângulo Mineiro',
    conformity: 0.78,
    problems: 24,
  },
  { acronym: 'IFG', name: 'Instituto Federal de Goiás', conformity: 0.57, problems: 41 },
  { acronym: 'IFB', name: 'Instituto Federal de Brasília', conformity: 0.39, problems: 63 },
  { acronym: 'IFX', name: 'Instituto Federal de Exemplo', conformity: null, problems: null },
];

/** Catálogo do design system (Fase 5). Só existe em desenvolvimento. */
export function UiCatalogPage() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <PageTitle>Catálogo de componentes</PageTitle>
        <p className="text-body text-text-muted">
          Componentes do design system (seção 4 do plano). Página disponível apenas em
          desenvolvimento.
        </p>
      </div>

      <Section title="Marca">
        <div className="flex flex-wrap items-center gap-8">
          <Logo variant="symbol" />
          <Logo variant="compact" />
          <Logo />
          <Logo subtitle />
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap gap-3">
          <Button>
            <CirclePlus aria-hidden="true" size={16} strokeWidth={1.75} />
            Nova auditoria
          </Button>
          <Button variant="secondary">
            <Download aria-hidden="true" size={16} strokeWidth={1.75} />
            Baixar CSV
          </Button>
          <Button variant="secondary">
            <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
            Tentar novamente
          </Button>
          <Button disabled>
            <Check aria-hidden="true" size={16} strokeWidth={1.75} />
            Confirmar
          </Button>
        </div>
      </Section>

      <Section title="Selos">
        <div className="flex flex-wrap gap-2">
          <Badge variant="critical">Crítico</Badge>
          <Badge variant="moderate">Moderado</Badge>
          <Badge variant="partial">Parcial</Badge>
          <Badge variant="good">Bom</Badge>
          <Badge variant="automated">Automatizada</Badge>
          <Badge variant="inspection">Inspeção</Badge>
          <Badge variant="neutral">2 de 4</Badge>
        </div>
      </Section>

      <Section title="Indicadores">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Portais avaliados" value="38" />
          <StatCard
            label="Conformidade média"
            value="64%"
            hint="Apenas critérios verificáveis automaticamente."
          />
          <StatCard label="Problemas distintos" value="1.247" />
        </div>
      </Section>

      <Section title="Barra de conformidade">
        <div className="flex flex-col gap-3">
          <ConformityBar value={0.78} label="Conformidade de exemplo, nível bom" />
          <ConformityBar value={0.57} label="Conformidade de exemplo, nível parcial" />
          <ConformityBar value={0.39} label="Conformidade de exemplo, nível crítico" />
          <ConformityBar value={null} label="Conformidade de exemplo sem dado" />
        </div>
      </Section>

      <Section title="Campos">
        <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
          <SearchField label="Buscar instituição" placeholder="Digite o nome ou a sigla" />
          <TextField
            label="Domínio"
            hint="Sem https://, por exemplo iftm.edu.br."
            placeholder="iftm.edu.br"
          />
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            error="Informe um e-mail válido."
          />
        </div>
      </Section>

      <Section title="Tabela">
        <DataTable
          caption="Conformidade por instituição (dados de exemplo)"
          rows={institutions}
          rowKey={(row) => row.acronym}
          columns={[
            {
              key: 'institution',
              header: 'Instituição',
              rowHeader: true,
              cell: (row) => (
                <Link
                  to={`/instituicoes/${row.acronym.toLowerCase()}`}
                  className="text-accent underline underline-offset-2"
                >
                  {row.acronym}
                </Link>
              ),
            },
            {
              key: 'conformity',
              header: 'Conformidade',
              cell: (row) => (
                <ConformityBar value={row.conformity} label={`Conformidade do ${row.acronym}`} />
              ),
            },
            {
              key: 'problems',
              header: 'Problemas distintos',
              align: 'end',
              cell: (row) => row.problems ?? '—',
            },
          ]}
        />
      </Section>

      <Section title="Card de problema">
        <FindingCard
          severity="critical"
          origin="automated"
          wcagCriteria="1.1.1"
          principle="perceivable"
          title="Imagem sem texto alternativo"
          description="O banner da página inicial não possui atributo alt, deixando o conteúdo inacessível a leitores de tela."
          pageUrl="https://www.iftm.edu.br/"
          snippet={'<img src="/banner-ingresso.png">'}
          recommendation='adicionar alt descrevendo a função da imagem, ou alt="" se for decorativa.'
        />
      </Section>

      <Section title="Navegação">
        <div className="grid gap-8 sm:grid-cols-2">
          <nav
            aria-label="Exemplo de itens de navegação"
            className="max-w-56 rounded-lg bg-surface p-3 shadow-card"
          >
            <ul className="flex flex-col gap-0.5">
              <li>
                <NavItem to="/painel" label="Painel" icon={LayoutDashboard} />
              </li>
              <li>
                <NavItem to="/dev/ui" label="Catálogo (ativo)" icon={Activity} />
              </li>
            </ul>
          </nav>
          <div className="flex flex-col gap-4">
            <Stepper current={0} />
            <Stepper current={1} />
            <Stepper current={2} />
          </div>
        </div>
      </Section>

      <Section title="Estados">
        <EmptyState
          headingLevel={3}
          title="Nenhuma coleta ainda"
          description="Comece uma auditoria para ver os indicadores de conformidade dos portais."
          action={
            <Button>
              <CirclePlus aria-hidden="true" size={16} strokeWidth={1.75} />
              Nova auditoria
            </Button>
          }
        />
        <ErrorState
          headingLevel={3}
          title="2 páginas falharam"
          description="O portal não respondeu dentro do tempo limite. Os dados dessas páginas ficam fora da média."
          action={
            <Button variant="secondary">
              <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
              Tentar novamente
            </Button>
          }
        />
      </Section>
    </div>
  );
}
