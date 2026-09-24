import {
  assistiveCheckKinds,
  assistiveCheckStates,
  axeImpacts,
  collectionPageStatuses,
  collectionStatuses,
  findingValidations,
  heuristics,
  routeSources,
  routeStatuses,
  severities,
  taskResults,
  wcagPrinciples,
} from '@auditoria-rf/contracts';
import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

// Modelo de dados: seção 2 do plano. Datas em milissegundos desde a época (UTC).

const id = () => integer('id').primaryKey({ autoIncrement: true });
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () =>
  timestamp('created_at')
    .notNull()
    .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`);

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});

// Sessões do auditor: o cookie guarda um token aleatório; aqui fica só o hash SHA-256 dele.
export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: createdAt(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (t) => [index('sessions_expires_at_idx').on(t.expiresAt)],
);

export const institutions = sqliteTable('institutions', {
  id: id(),
  name: text('name').notNull(),
  acronym: text('acronym').notNull(),
  domain: text('domain').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
});

export const pageFunctions = sqliteTable('page_functions', {
  id: id(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
});

export const routes = sqliteTable(
  'routes',
  {
    id: id(),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    url: text('url').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    functionId: integer('function_id').references(() => pageFunctions.id),
    source: text('source', { enum: routeSources }).notNull(),
    status: text('status', { enum: routeStatuses }).notNull().default('suggested'),
    exclusionReason: text('exclusion_reason'),
    replacedByRouteId: integer('replaced_by_route_id').references((): AnySQLiteColumn => routes.id),
    discoveredAt: timestamp('discovered_at')
      .notNull()
      .default(sql`(cast(unixepoch('subsec') * 1000 as integer))`),
    confirmedAt: timestamp('confirmed_at'),
    lastSeenAt: timestamp('last_seen_at'),
    // Indícios da descoberta, só para ordenar e exibir as candidatas (ADR 0011).
    title: text('title'),
    linkText: text('link_text'),
    relevance: integer('relevance'),
  },
  (t) => [unique().on(t.institutionId, t.normalizedUrl)],
);

// Função procurada e não encontrada no portal (ADR 0013): decisão do auditor, com motivo. Entra na
// cobertura; sem ela, "não tem a página" e "não foi revisado" seriam indistinguíveis.
export const functionAbsences = sqliteTable(
  'function_absences',
  {
    id: id(),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    functionId: integer('function_id')
      .notNull()
      .references(() => pageFunctions.id),
    reason: text('reason').notNull(),
    decidedBy: integer('decided_by')
      .notNull()
      .references(() => users.id),
    decidedAt: createdAt(),
  },
  (t) => [unique().on(t.institutionId, t.functionId)],
);

export const collections = sqliteTable('collections', {
  id: id(),
  status: text('status', { enum: collectionStatuses }).notNull().default('queued'),
  scopeJson: text('scope_json', { mode: 'json' }).notNull(),
  axeVersion: text('axe_version'),
  browserVersion: text('browser_version'),
  userAgent: text('user_agent'),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

export const collectionPages = sqliteTable(
  'collection_pages',
  {
    id: id(),
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id),
    routeId: integer('route_id')
      .notNull()
      .references(() => routes.id),
    // Função da página no momento da coleta.
    functionId: integer('function_id').references(() => pageFunctions.id),
    status: text('status', { enum: collectionPageStatuses }).notNull().default('queued'),
    httpStatus: integer('http_status'),
    error: text('error'),
    snapshotPath: text('snapshot_path'),
    passesCount: integer('passes_count').notNull().default(0),
    violationsCount: integer('violations_count').notNull().default(0),
    incompleteCount: integer('incomplete_count').notNull().default(0),
    inapplicableCount: integer('inapplicable_count').notNull().default(0),
    evaluatedAt: timestamp('evaluated_at'),
  },
  (t) => [
    unique().on(t.collectionId, t.routeId),
    index('collection_pages_queue_idx').on(t.collectionId, t.status),
  ],
);

export const findings = sqliteTable(
  'findings',
  {
    id: id(),
    collectionPageId: integer('collection_page_id')
      .notNull()
      .references(() => collectionPages.id),
    ruleId: text('rule_id').notNull(),
    wcagCriteria: text('wcag_criteria').notNull(),
    principle: text('principle', { enum: wcagPrinciples }).notNull(),
    axeImpact: text('axe_impact', { enum: axeImpacts }).notNull(),
    severity: text('severity', { enum: severities }).notNull(),
    selector: text('selector').notNull(),
    htmlSnippet: text('html_snippet').notNull(),
    help: text('help').notNull(),
    helpUrl: text('help_url').notNull(),
    fingerprint: text('fingerprint').notNull(),
    validation: text('validation', { enum: findingValidations }).notNull().default('pending'),
    validationNote: text('validation_note'),
    validatedBy: integer('validated_by').references(() => users.id),
    validatedAt: timestamp('validated_at'),
  },
  (t) => [
    index('findings_collection_page_idx').on(t.collectionPageId),
    index('findings_fingerprint_idx').on(t.fingerprint),
  ],
);

export const targetTasks = sqliteTable('target_tasks', {
  id: id(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  functionId: integer('function_id')
    .notNull()
    .references(() => pageFunctions.id),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

// Subamostra da camada manual: portais escolhidos pelo auditor numa coleta (ADR 0008).
export const inspectionSample = sqliteTable(
  'inspection_sample',
  {
    id: id(),
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    selectedBy: integer('selected_by')
      .notNull()
      .references(() => users.id),
    selectedAt: createdAt(),
  },
  (t) => [unique().on(t.collectionId, t.institutionId)],
);

export const taskInspections = sqliteTable(
  'task_inspections',
  {
    id: id(),
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id),
    institutionId: integer('institution_id')
      .notNull()
      .references(() => institutions.id),
    taskId: integer('task_id')
      .notNull()
      .references(() => targetTasks.id),
    result: text('result', { enum: taskResults }).notNull(),
    interactions: integer('interactions').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    depth: integer('depth').notNull(),
    pathJson: text('path_json', { mode: 'json' }).notNull(),
    heuristic: text('heuristic', { enum: heuristics }),
    severity: text('severity', { enum: severities }),
    note: text('note').notNull(),
    inspectorId: integer('inspector_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.collectionId, t.institutionId, t.taskId)],
);

export const assistiveChecks = sqliteTable(
  'assistive_checks',
  {
    id: id(),
    collectionPageId: integer('collection_page_id')
      .notNull()
      .references(() => collectionPages.id),
    kind: text('kind', { enum: assistiveCheckKinds }).notNull(),
    state: text('state', { enum: assistiveCheckStates }).notNull().default('pending'),
    severity: text('severity', { enum: severities }),
    note: text('note'),
    inspectorId: integer('inspector_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.collectionPageId, t.kind)],
);
