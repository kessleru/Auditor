import type { ContrastEvidence, FindingExample } from '@auditoria-rf/contracts';
import { useState } from 'react';

const ratio = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Texto visível do trecho, sem as marcações (o parser não executa scripts nem carrega nada). */
function textOf(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Texto de exemplo';
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 rounded-sm border border-border align-middle"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Amostra do texto reprovado com as cores e a fonte medidas pelo axe. É SVG de propósito: o
 * contraste baixo é o problema que se quer mostrar, e o axe do próprio sistema não avalia texto
 * de SVG. A informação não depende da cor: razão e cores vão escritas ao lado.
 */
function ContrastSample({ evidence, text }: { evidence: ContrastEvidence; text: string }) {
  // Nunca abaixo de 13 px (regra do front); o tamanho real vai escrito na legenda.
  const size = Math.min(Math.max(evidence.fontSizePx, 13), 32);
  return (
    <div className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={`Amostra do texto "${text}" como aparece no portal: cor ${evidence.fgColor} sobre ${evidence.bgColor}`}
        width="100%"
        height={Math.round(size * 2.4)}
        className="rounded-md border border-border"
      >
        <rect width="100%" height="100%" fill={evidence.bgColor} />
        <text
          x="12"
          y="50%"
          dominantBaseline="middle"
          fill={evidence.fgColor}
          fontSize={size}
          fontWeight={evidence.bold ? 700 : 400}
          fontFamily="system-ui, sans-serif"
        >
          {text}
        </text>
      </svg>
      <p className="text-label text-text">
        Razão {ratio.format(evidence.contrastRatio)}:1 — mínimo{' '}
        {ratio.format(evidence.expectedContrastRatio)}:1 <Swatch color={evidence.fgColor} /> texto{' '}
        {evidence.fgColor} sobre fundo <Swatch color={evidence.bgColor} /> {evidence.bgColor}, fonte
        de {ratio.format(evidence.fontSizePx)} px{evidence.bold ? ' em negrito' : ''}.
      </p>
    </div>
  );
}

/**
 * Como o elemento com problema aparece no portal (ADR 0014): a foto tirada na coleta, com o
 * elemento destacado, e, no contraste, a amostra com as cores reais. Sem nenhuma das duas (coleta
 * antiga, elemento invisível), não mostra nada: o código continua no card.
 */
export function FindingPreview({ example }: { example: FindingExample }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = example.screenshotUrl && !photoFailed ? example.screenshotUrl : null;
  const contrast = example.evidence?.kind === 'contrast' ? example.evidence : null;
  if (!photo && !contrast) return null;

  return (
    <figure className="flex flex-col gap-2">
      {photo ? (
        <img
          src={photo}
          alt="Foto do elemento no portal, com o problema destacado por um contorno vermelho"
          loading="lazy"
          onError={() => setPhotoFailed(true)}
          className="max-h-80 w-fit max-w-full rounded-md border border-border bg-muted object-contain"
        />
      ) : null}
      {contrast ? <ContrastSample evidence={contrast} text={textOf(example.htmlSnippet)} /> : null}
      <figcaption className="text-label text-text-muted">
        Como aparece no portal, na coleta.
      </figcaption>
    </figure>
  );
}
