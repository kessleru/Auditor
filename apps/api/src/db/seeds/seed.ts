import { type PageFunctionKey, pageFunctionLabels } from '@auditoria-rf/contracts';
import { and, eq } from 'drizzle-orm';
import type { DB } from '../client.js';
import { institutions, pageFunctions, targetTasks } from '../schema.js';
import { federalNetwork } from './federal-network.js';

// Enunciados fixos: o mesmo texto em todas as instituições garante a comparabilidade (seção 3.4).
const targetTaskSeeds: { functionKey: PageFunctionKey; title: string; description: string }[] = [
  {
    functionKey: 'home',
    title: 'Contato institucional',
    description:
      'Encontrar um canal de contato da instituição (telefone ou e-mail) a partir da página inicial.',
  },
  {
    functionKey: 'admission',
    title: 'Edital do processo seletivo',
    description:
      'Encontrar o edital do processo seletivo vigente para ingresso em cursos técnicos ou de graduação.',
  },
  {
    functionKey: 'student_aid_notices',
    title: 'Edital de auxílio estudantil',
    description: 'Encontrar o edital mais recente de auxílio estudantil.',
  },
  {
    functionKey: 'library',
    title: 'Horário da biblioteca',
    description: 'Encontrar o horário de funcionamento da biblioteca.',
  },
  {
    functionKey: 'student_support',
    title: 'Atendimento da assistência estudantil',
    description: 'Descobrir como solicitar atendimento da assistência estudantil.',
  },
  // Funções acrescentadas na ADR 0013. A tarefa de contato já existe (página inicial).
  {
    functionKey: 'courses',
    title: 'Cursos ofertados',
    description: 'Encontrar a lista de cursos técnicos ou de graduação ofertados pela instituição.',
  },
  {
    functionKey: 'academic_calendar',
    title: 'Calendário acadêmico',
    description: 'Encontrar o calendário acadêmico do ano letivo vigente.',
  },
  {
    functionKey: 'class_schedule',
    title: 'Horário de aulas',
    description: 'Encontrar o horário de aulas de uma turma de curso técnico ou de graduação.',
  },
  {
    functionKey: 'ombudsman',
    title: 'Manifestação na ouvidoria',
    description: 'Descobrir como registrar uma reclamação ou sugestão na ouvidoria.',
  },
  {
    functionKey: 'information_access',
    title: 'Pedido de acesso à informação',
    description:
      'Encontrar como fazer um pedido de acesso à informação (Serviço de Informação ao Cidadão).',
  },
  {
    functionKey: 'accessibility_support',
    title: 'Atendimento do núcleo de acessibilidade',
    description:
      'Descobrir como solicitar atendimento do núcleo de acessibilidade (NAPNE) para um estudante com deficiência.',
  },
  {
    functionKey: 'campuses',
    title: 'Endereço de um campus',
    description: 'Encontrar o endereço de um dos campi da instituição.',
  },
];

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * Funções de página e tarefas-alvo: dados de que o código depende. Idempotente; o servidor e as
 * CLIs chamam ao subir, para um banco antigo ganhar as funções novas sem depender do seed.
 */
export function seedReferenceData(db: DB) {
  db.transaction((tx) => insertReferenceData(tx));
}

function insertReferenceData(tx: Tx) {
  tx.insert(pageFunctions)
    .values(Object.entries(pageFunctionLabels).map(([key, label]) => ({ key, label })))
    .onConflictDoNothing({ target: pageFunctions.key })
    .run();

  const functionIds = new Map(
    tx
      .select({ id: pageFunctions.id, key: pageFunctions.key })
      .from(pageFunctions)
      .all()
      .map((row) => [row.key, row.id]),
  );

  for (const task of targetTaskSeeds) {
    const functionId = functionIds.get(task.functionKey);
    if (functionId === undefined) throw new Error(`Função ${task.functionKey} ausente.`);

    const existing = tx
      .select({ id: targetTasks.id })
      .from(targetTasks)
      .where(and(eq(targetTasks.functionId, functionId), eq(targetTasks.title, task.title)))
      .get();
    if (!existing) {
      tx.insert(targetTasks)
        .values({ functionId, title: task.title, description: task.description })
        .run();
    }
  }
}

/**
 * Popula os dados de referência (funções, tarefas-alvo) e a Rede Federal; pode ser executado
 * várias vezes sem duplicar registros.
 */
export function seed(db: DB) {
  db.transaction((tx) => {
    insertReferenceData(tx);

    // Uma instituição já cadastrada (mesmo domínio ou mesma sigla) nunca é duplicada nem alterada.
    const existing = tx
      .select({ acronym: institutions.acronym, domain: institutions.domain })
      .from(institutions)
      .all();
    const missing = federalNetwork.filter(
      (i) => !existing.some((e) => e.domain === i.domain || e.acronym === i.acronym),
    );
    if (missing.length > 0) {
      tx.insert(institutions)
        .values([...missing])
        .onConflictDoNothing({ target: institutions.domain })
        .run();
    }
  });
}
