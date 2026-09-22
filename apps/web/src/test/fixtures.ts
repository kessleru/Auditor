import type { Methodology, PublicInstitution, PublicProblem } from '@auditoria-rf/contracts';

export const iftm: PublicInstitution = {
  id: 1,
  name: 'Instituto Federal do Triângulo Mineiro',
  acronym: 'IFTM',
  domain: 'iftm.edu.br',
  status: 'evaluated',
  collectionId: 3,
  collectedAt: '2026-09-12T15:00:00.000Z',
  conformity: 0.78,
  classification: 'good',
  problems: 24,
  criticalProblems: 5,
  templateProblems: 2,
  pendingValidation: 3,
  pagesEvaluated: 4,
  pagesTotal: 4,
};

export const ifx: PublicInstitution = {
  ...iftm,
  id: 2,
  name: 'Instituto Federal de Exemplo',
  acronym: 'IFX',
  domain: 'ifx.edu.br',
  status: 'no_data',
  conformity: null,
  classification: null,
  problems: null,
  criticalProblems: null,
  templateProblems: null,
  pendingValidation: 0,
  pagesEvaluated: 0,
};

export const ifn: PublicInstitution = {
  ...ifx,
  id: 3,
  name: 'Instituto Federal Novo',
  acronym: 'IFN',
  domain: 'ifn.edu.br',
  status: 'not_collected',
  collectionId: null,
  collectedAt: null,
  pagesTotal: 0,
};

export const problems: PublicProblem[] = [
  {
    fingerprint: 'a',
    ruleId: 'image-alt',
    title: 'Imagens devem ter texto alternativo',
    description: 'Certifique-se de que elementos <img> tenham texto alternativo',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    wcagCriteria: '1.1.1',
    principle: 'perceivable',
    severity: 'critical',
    template: true,
    pages: 4,
    occurrences: 4,
    example: {
      pageUrl: 'https://iftm.edu.br',
      selector: 'header img',
      htmlSnippet: '<img src="logo.png">',
    },
  },
  {
    fingerprint: 'b',
    ruleId: 'link-name',
    title: 'Links devem ter um texto discernível',
    description: 'Certifique-se de que links tenham um texto discernível',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/link-name',
    wcagCriteria: '2.4.4, 4.1.2',
    principle: 'operable',
    severity: 'moderate',
    template: false,
    pages: 1,
    occurrences: 2,
    example: {
      pageUrl: 'https://iftm.edu.br/ingresso',
      selector: 'footer a',
      htmlSnippet: '<a href="/x"></a>',
    },
  },
];

export const methodology: Methodology = {
  axeVersion: '4.13.0',
  browserVersion: 'Chromium 153.0.8010.12',
  lastCollectionAt: '2026-09-12T15:00:00.000Z',
  axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  thresholds: { good: 0.75, partial: 0.5 },
  templateThreshold: 0.8,
  templateMinPages: 2,
  contactEmail: 'pesquisa@example.org',
};

export const publicRoutes = {
  'GET /public/summary': {
    lastCollectionAt: '2026-09-12T15:00:00.000Z',
    institutionsTotal: 3,
    institutionsEvaluated: 1,
    averageConformity: 0.78,
  },
  'GET /public/institutions': { institutions: [iftm, ifx, ifn] },
  'GET /public/institutions/1': {
    institution: iftm,
    history: [
      { collectionId: 1, collectedAt: '2026-03-10T15:00:00.000Z', conformity: 0.62 },
      { collectionId: 2, collectedAt: '2026-06-10T15:00:00.000Z', conformity: null },
      { collectionId: 3, collectedAt: '2026-09-12T15:00:00.000Z', conformity: 0.78 },
    ],
  },
  'GET /public/institutions/1/findings': { problems },
  'GET /public/institutions/2': { institution: ifx, history: [] },
  'GET /public/methodology': methodology,
  'GET /collections': { collections: [] },
};
