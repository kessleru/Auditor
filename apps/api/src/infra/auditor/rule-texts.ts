import { createRequire } from 'node:module';

interface LocaleRule {
  description?: string;
  help?: string;
}

// Textos em português do próprio axe-core fixado (locales/pt_BR.json). Traduzidos na leitura:
// os dados gravados não mudam e coletas antigas também aparecem em português.
const ptBR = createRequire(import.meta.url)('axe-core/locales/pt_BR.json') as {
  rules: Record<string, LocaleRule>;
  checks: Record<string, { incomplete?: string | Record<string, string> }>;
};

interface CheckResult {
  id: string;
  data?: unknown;
  message?: string;
}

/**
 * Por que o axe não decidiu o elemento (`incomplete`), em português: a mensagem do locale pt_BR do
 * check que ficou inconclusivo, escolhida pelo `messageKey` do axe. Sem tradução, a do axe.
 */
export function incompleteReason(node: {
  any: CheckResult[];
  all: CheckResult[];
  none: CheckResult[];
}): string {
  for (const check of [...node.any, ...node.all, ...node.none]) {
    const messages = ptBR.checks[check.id]?.incomplete;
    if (!messages) continue;
    const data = (check.data ?? {}) as Record<string, unknown>;
    const key = typeof data['messageKey'] === 'string' ? data['messageKey'] : 'default';
    const template =
      typeof messages === 'string' ? messages : (messages[key] ?? messages['default']);
    if (!template) continue;
    // Troca ${data.x} pelo valor medido; o que não houver fica sem o trecho.
    return template.replace(/\$\{data\.(\w+)\}/g, (_, name: string) =>
      data[name] === undefined ? '' : String(data[name]),
    );
  }
  const english = [...node.any, ...node.all, ...node.none].find((c) => c.message)?.message;
  return english ?? 'O axe não conseguiu decidir sozinho.';
}

/**
 * Regras das tags usadas na coleta que o locale pt_BR do axe-core 4.13 não traduz. Só texto de
 * exibição: o resultado da auditoria não muda. O teste confere que nenhuma regra fica em inglês.
 */
const MISSING_PT_BR: Record<string, LocaleRule> = {
  'aria-braille-equivalent': {
    help: 'Atributos ARIA de braille devem ter um equivalente fora do braille',
    description:
      'Garante que aria-braillelabel e aria-brailleroledescription tenham um equivalente fora do braille',
  },
  'aria-conditional-attr': {
    help: 'Atributos ARIA devem ser usados como especificado para a função do elemento',
    description:
      'Garante que os atributos ARIA sejam usados como descrito na especificação da função do elemento',
  },
  'aria-deprecated-role': {
    help: 'Funções ARIA obsoletas não devem ser usadas',
    description: 'Garante que os elementos não usem funções (roles) ARIA obsoletas',
  },
  'aria-prohibited-attr': {
    help: 'Elementos devem usar apenas atributos ARIA permitidos',
    description: 'Garante que os atributos ARIA não sejam proibidos para a função do elemento',
  },
  'aria-tab-name': {
    help: 'Abas ARIA devem ter um nome acessível',
    description: 'Garante que todo elemento com função de aba (tab) tenha um nome acessível',
  },
  'summary-name': {
    help: 'Elementos summary devem ter texto discernível',
    description: 'Garante que os elementos summary tenham texto discernível',
  },
  'target-size': {
    help: 'Alvos de toque devem ter ao menos 24 px ou espaço suficiente ao redor',
    description: 'Garante que os alvos de toque tenham tamanho e espaçamento suficientes',
  },
};

/** Título e descrição da regra em português; sem tradução, usa o texto gravado na coleta. */
export function ruleTexts(ruleId: string, fallbackHelp: string) {
  const rule = ptBR.rules[ruleId] ?? MISSING_PT_BR[ruleId];
  return {
    title: rule?.help ?? fallbackHelp,
    description: rule?.description ?? fallbackHelp,
  };
}
