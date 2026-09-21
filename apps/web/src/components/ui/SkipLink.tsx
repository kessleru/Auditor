/** Primeiro elemento focável da página (seção 5.4). */
export function SkipLink({ targetId = 'conteudo' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only rounded-md bg-accent px-4 py-2 text-label font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
    >
      Pular para o conteúdo
    </a>
  );
}
