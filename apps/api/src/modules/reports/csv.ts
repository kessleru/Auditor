/**
 * Texto que começa com `=`, `+`, `-`, `@`, tabulação ou retorno vira fórmula ao abrir no Excel
 * ou no Calc (injeção de CSV). Nomes, títulos e seletores vêm de fora: ganham um `'` na frente,
 * que as planilhas mostram como texto. Números não passam por aqui.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** CSV conforme RFC 4180: vírgula, aspas duplas, CRLF; UTF-8 com BOM (abre certo no Excel). */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const raw = String(value);
    const text = typeof value === 'string' && FORMULA_START.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [header, ...rows].map((row) => row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
