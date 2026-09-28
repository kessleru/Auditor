import { z } from 'zod';
import { pageFunctionKeys } from './domain.js';

// Indicadores da pesquisa, só para o auditor: quanto a ferramenta acerta sem revisão humana. Base:
// a coleta terminada mais recente de cada instituição, a mesma dos resultados (ADR 0009).

/** Validação dos problemas distintos de uma regra do axe. */
export const ruleValidationSchema = z.object({
  ruleId: z.string(),
  title: z.string(),
  /** Problemas distintos (fingerprint por coleta). */
  problems: z.number().int(),
  confirmed: z.number().int(),
  falsePositive: z.number().int(),
  pending: z.number().int(),
  /** Confirmados ÷ (confirmados + falsos positivos); `null` se nenhum foi validado. */
  confirmationRate: z.number().nullable(),
});
export type RuleValidation = z.infer<typeof ruleValidationSchema>;

/**
 * Acerto da sugestão de função nas rotas confirmadas. A sugestão é recalculada com as
 * palavras-chave atuais a partir do endereço, do título e do texto do link guardados na descoberta.
 */
export const suggestionAccuracySchema = z.object({
  functionKey: z.enum(pageFunctionKeys),
  /** Rotas confirmadas que a descoberta encontrou (fora as informadas à mão). */
  discovered: z.number().int(),
  /** A sugestão era a função confirmada. */
  hits: z.number().int(),
  /** A sugestão era outra função. */
  otherFunction: z.number().int(),
  /** A descoberta não sugeriu função nenhuma. */
  noSuggestion: z.number().int(),
  /** Rotas informadas à mão pelo auditor (a descoberta não achou a página). */
  manual: z.number().int(),
  /** Instituições em que a função foi marcada como não encontrada. */
  absent: z.number().int(),
});
export type SuggestionAccuracy = z.infer<typeof suggestionAccuracySchema>;

export const indicatorsSchema = z.object({
  /** Coletas consideradas (a mais recente terminada de cada instituição ativa). */
  collections: z.number().int(),
  rules: z.array(ruleValidationSchema),
  suggestions: z.array(suggestionAccuracySchema),
});
export type Indicators = z.infer<typeof indicatorsSchema>;
