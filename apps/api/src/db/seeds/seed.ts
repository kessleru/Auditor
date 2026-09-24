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
];

/** Popula os dados de referência (funções, tarefas-alvo e a Rede Federal); pode ser executado várias vezes sem duplicar registros. */
export function seed(db: DB) {
  db.transaction((tx) => {
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
