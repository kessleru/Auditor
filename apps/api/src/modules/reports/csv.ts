/** CSV conforme RFC 4180: vírgula, aspas duplas, CRLF; UTF-8 com BOM (abre certo no Excel). */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'number' ? String(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [header, ...rows].map((row) => row.map(cell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
