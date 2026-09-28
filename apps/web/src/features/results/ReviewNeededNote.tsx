import { formatNumber } from '../../lib/format';

/**
 * Casos que o axe não conseguiu decidir (`incomplete`): ficam fora da conformidade, mas são
 * exibidos (seção 3.3 do plano), porque pedem revisão humana.
 */
export function ReviewNeededNote({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <p className="text-label text-text-muted">
      {count === 1
        ? '1 verificação ficou inconclusiva para o axe'
        : `${formatNumber(count)} verificações ficaram inconclusivas para o axe`}{' '}
      (por exemplo, contraste de texto sobre imagem) e pedem revisão humana. Ficam fora da
      conformidade.
    </p>
  );
}
