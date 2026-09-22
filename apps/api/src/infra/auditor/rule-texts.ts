import { createRequire } from 'node:module';

interface LocaleRule {
  description?: string;
  help?: string;
}

// Textos em português do próprio axe-core fixado (locales/pt_BR.json). Traduzidos na leitura:
// os dados gravados não mudam e coletas antigas também aparecem em português.
const ptBR = createRequire(import.meta.url)('axe-core/locales/pt_BR.json') as {
  rules: Record<string, LocaleRule>;
};

/** Título e descrição da regra em português; sem tradução, usa o texto gravado na coleta. */
export function ruleTexts(ruleId: string, fallbackHelp: string) {
  const rule = ptBR.rules[ruleId];
  return {
    title: rule?.help ?? fallbackHelp,
    description: rule?.description ?? fallbackHelp,
  };
}
