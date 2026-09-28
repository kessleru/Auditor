import type {
  ContrastEvidence,
  FindingEvidence,
  FindingExample,
  TargetSizeEvidence,
} from '@auditoria-rf/contracts';
import { useState } from 'react';

const ratio = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const px = (value: number) => `${ratio.format(value)} px`;

/** Primeira família da lista calculada pelo navegador, sem aspas ("Open Sans", Arial → Open Sans). */
function firstFamily(fontFamily: string): string {
  return (fontFamily.split(',')[0] ?? '').replace(/["']/g, '').trim();
}

/** Tipos de campo mais comuns, em português; os demais aparecem como o navegador informa. */
const FIELD_TYPES: Record<string, string> = {
  text: 'texto',
  search: 'busca',
  email: 'e-mail',
  password: 'senha',
  tel: 'telefone',
  number: 'número',
  date: 'data',
  url: 'endereço (URL)',
  checkbox: 'caixa de seleção',
  radio: 'botão de opção',
  file: 'arquivo',
  select: 'lista de opções',
  textarea: 'área de texto',
};

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
  // A fonte do portal, se estiver instalada em quem vê; senão, a do sistema.
  const family = evidence.fontFamily ? firstFamily(evidence.fontFamily) : null;
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
          fontFamily={family ? `"${family}", system-ui, sans-serif` : 'system-ui, sans-serif'}
        >
          {text}
        </text>
      </svg>
      <p className="text-label text-text">
        Razão {ratio.format(evidence.contrastRatio)}:1 — mínimo{' '}
        {ratio.format(evidence.expectedContrastRatio)}:1 <Swatch color={evidence.fgColor} /> texto{' '}
        {evidence.fgColor} sobre fundo <Swatch color={evidence.bgColor} /> {evidence.bgColor}, fonte
        {family ? ` ${family}` : ''} de {px(evidence.fontSizePx)}
        {evidence.bold ? ' em negrito' : ''}.
      </p>
    </div>
  );
}

function targetSizeText(evidence: TargetSizeEvidence): string {
  const parts: string[] = [];
  if (evidence.widthPx !== null && evidence.heightPx !== null) {
    parts.push(
      `Alvo de ${ratio.format(evidence.widthPx)} × ${px(evidence.heightPx)} — mínimo ${ratio.format(evidence.minSizePx)} × ${px(evidence.minSizePx)}`,
    );
  }
  if (evidence.closestOffsetPx !== null && evidence.minOffsetPx !== null) {
    parts.push(
      `vizinho mais próximo a ${px(evidence.closestOffsetPx)} — mínimo ${px(evidence.minOffsetPx)}`,
    );
  }
  const text = parts.join('; ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** Evidência em texto das regras sem amostra visual: o que foi medido ou lido do elemento. */
function EvidenceText({ evidence }: { evidence: Exclude<FindingEvidence, ContrastEvidence> }) {
  if (evidence.kind === 'target-size') {
    return <p className="text-label text-text">{targetSizeText(evidence)}</p>;
  }
  const [label, value] =
    evidence.kind === 'image'
      ? ['Endereço da imagem', evidence.src]
      : evidence.kind === 'link'
        ? ['Destino do link', evidence.href]
        : [
            'Tipo do campo',
            FIELD_TYPES[evidence.fieldType]
              ? `${FIELD_TYPES[evidence.fieldType]} (${evidence.fieldType})`
              : evidence.fieldType,
          ];
  // Texto, nunca link: o endereço vem do portal e só descreve o elemento.
  return (
    <p className="text-label text-text">
      {label}: <code className="font-mono text-code break-all">{value}</code>
    </p>
  );
}

/**
 * Como o elemento com problema aparece no portal (ADR 0014): a foto tirada na coleta, com o
 * elemento destacado, e a evidência medida (no contraste, a amostra com as cores reais; no tamanho
 * do alvo, as medidas; na imagem, no link e no campo, o que foi lido do elemento). Sem foto nem
 * evidência (coleta antiga, elemento invisível), não mostra nada: o código continua no card.
 */
export function FindingPreview({ example }: { example: FindingExample }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = example.screenshotUrl && !photoFailed ? example.screenshotUrl : null;
  const { evidence } = example;
  if (!photo && !evidence) return null;

  return (
    <figure className="flex flex-col gap-2">
      {photo ? (
        <>
          <img
            src={photo}
            alt="Foto do elemento no portal, com o problema destacado por um contorno vermelho"
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="max-h-80 w-fit max-w-full rounded-md border border-border bg-muted object-contain"
          />
          <a
            href={photo}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit text-label text-accent-text underline underline-offset-2 hover:decoration-2"
          >
            abrir a foto em tamanho real (abre em nova aba)
          </a>
        </>
      ) : null}
      {evidence?.kind === 'contrast' ? (
        <ContrastSample evidence={evidence} text={textOf(example.htmlSnippet)} />
      ) : evidence ? (
        <EvidenceText evidence={evidence} />
      ) : null}
      <figcaption className="text-label text-text-muted">
        Como aparece no portal, na coleta.
      </figcaption>
    </figure>
  );
}
