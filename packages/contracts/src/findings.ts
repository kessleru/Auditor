import { z } from 'zod';

// Evidência de um achado, para a interface mostrar o problema sem abrir o portal (ADR 0014): o que
// o axe já mediu e, para algumas regras, o que o navegador leu do elemento na coleta.

/** Contraste (`color-contrast`): as cores e a fonte do texto reprovado, medidas pelo axe. */
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
  /**
   * Família da fonte calculada pelo navegador na coleta (o axe não informa). Ausente nas coletas
   * anteriores e no preenchimento retroativo.
   */
  fontFamily: z.string().nullable().optional(),
});
export type ContrastEvidence = z.infer<typeof contrastEvidenceSchema>;

/** `target-size` (2.5.8): tamanho medido do alvo e a distância até o vizinho mais próximo. */
export const targetSizeEvidenceSchema = z.object({
  kind: z.literal('target-size'),
  widthPx: z.number().nullable(),
  heightPx: z.number().nullable(),
  minSizePx: z.number(),
  closestOffsetPx: z.number().nullable(),
  minOffsetPx: z.number().nullable(),
});
export type TargetSizeEvidence = z.infer<typeof targetSizeEvidenceSchema>;

/** Imagem sem texto alternativo: o endereço da imagem, lido do elemento na coleta. */
export const imageEvidenceSchema = z.object({ kind: z.literal('image'), src: z.string() });
/** Link sem nome: o destino, lido do elemento na coleta. */
export const linkEvidenceSchema = z.object({ kind: z.literal('link'), href: z.string() });
/** Campo sem rótulo: o tipo do campo (`search`, `email`, `select`, `textarea`...). */
export const fieldEvidenceSchema = z.object({ kind: z.literal('field'), fieldType: z.string() });

export const findingEvidenceSchema = z.discriminatedUnion('kind', [
  contrastEvidenceSchema,
  targetSizeEvidenceSchema,
  imageEvidenceSchema,
  linkEvidenceSchema,
  fieldEvidenceSchema,
]);
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
