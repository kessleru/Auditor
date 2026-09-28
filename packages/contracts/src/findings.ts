import { z } from 'zod';

/**
 * Evidência medida pelo axe para um achado de contraste (`color-contrast`): as cores e a fonte do
 * texto reprovado, para a interface mostrar como ele aparece sem abrir o portal (ADR 0014).
 */
export const contrastEvidenceSchema = z.object({
  kind: z.literal('contrast'),
  /** Cor do texto e do fundo, em hexadecimal (ex.: #777777). */
  fgColor: z.string(),
  bgColor: z.string(),
  /** Razão obtida e mínima exigida pelo critério (ex.: 2.8 e 4.5). */
  contrastRatio: z.number(),
  expectedContrastRatio: z.number(),
  fontSizePx: z.number(),
  bold: z.boolean(),
});
export type ContrastEvidence = z.infer<typeof contrastEvidenceSchema>;

export const findingEvidenceSchema = z.discriminatedUnion('kind', [contrastEvidenceSchema]);
export type FindingEvidence = z.infer<typeof findingEvidenceSchema>;

/** Um exemplo do problema: onde aparece, o código e, quando houver, a foto e a evidência. */
export const findingExampleSchema = z.object({
  findingId: z.number().int(),
  pageUrl: z.string(),
  selector: z.string(),
  htmlSnippet: z.string(),
  /** Foto do elemento tirada na coleta; `null` em coletas antigas ou elemento invisível. */
  screenshotUrl: z.string().nullable(),
  evidence: findingEvidenceSchema.nullable(),
});
export type FindingExample = z.infer<typeof findingExampleSchema>;
