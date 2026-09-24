import {
  type FunctionAbsence,
  type PageFunctionKey,
  pageFunctionLabels,
  type Route,
} from '@auditoria-rf/contracts';
import { type FormEvent, useId, useState } from 'react';
import { Badge, Button, TextField } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useClearAbsence, useCreateRoute, useMarkAbsent, useUpdateRoute } from './api';
import { byRelevance, candidatesFor, routeCaption } from './candidates';
import { displayUrl } from './routeLabels';

type State = 'confirmed' | 'absent' | 'suggested' | 'empty';

const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir. Tente de novo em instantes.';

const optionText = (route: Route) => {
  const text = route.title ?? route.linkText;
  return `${displayUrl(route.url)}${text ? ` — ${text}` : ''}`;
};

/**
 * Uma função avaliada: o que está decidido (ou sugerido) numa linha, uma ação principal e as
 * demais escolhas num painel recolhido — outra URL descoberta, URL informada à mão ou "não existe
 * no portal" (ADR 0013).
 */
export function FunctionReviewItem({
  functionKey,
  routes,
  absence,
  institutionId,
}: {
  functionKey: PageFunctionKey;
  routes: Route[];
  absence: FunctionAbsence | undefined;
  institutionId: number;
}) {
  const update = useUpdateRoute(institutionId);
  const create = useCreateRoute(institutionId);
  const markAbsent = useMarkAbsent(institutionId);
  const clearAbsence = useClearAbsence(institutionId);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<number | ''>('');
  const [manualUrl, setManualUrl] = useState('');
  const [reason, setReason] = useState('');
  const panelId = useId();
  const headingId = useId();
  const label = pageFunctionLabels[functionKey];

  const confirmed = routes.find((r) => r.status === 'confirmed' && r.functionKey === functionKey);
  const candidates = candidatesFor(routes, functionKey);
  const suggestion = confirmed || absence ? undefined : candidates[0];
  const state: State = confirmed
    ? 'confirmed'
    : absence
      ? 'absent'
      : suggestion
        ? 'suggested'
        : 'empty';
  const others = routes
    .filter(
      (r) =>
        (r.status === 'suggested' || r.status === 'confirmed') &&
        r !== confirmed &&
        r !== suggestion &&
        !candidates.includes(r),
    )
    .sort(byRelevance);
  const alternatives = candidates.filter((r) => r !== suggestion);
  const done = () => {
    setOpen(false);
    setChoice('');
    setManualUrl('');
    setReason('');
  };
  const confirm = (routeId: number) =>
    update.mutate(
      { id: routeId, status: 'confirmed', functionKey, replaceConfirmed: true },
      { onSuccess: done },
    );
  const pending = update.isPending || create.isPending || markAbsent.isPending;
  const error = update.error ?? create.error ?? markAbsent.error ?? clearAbsence.error;
  const toggleText =
    state === 'suggested' ? 'Outras opções' : state === 'empty' ? 'Resolver' : 'Alterar';

  return (
    <li aria-labelledby={headingId} className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <h3 id={headingId} className="flex flex-wrap items-center gap-2 text-body font-medium">
            {label} {state === 'confirmed' ? <Badge variant="good">Confirmada</Badge> : null}
            {state === 'absent' ? <Badge variant="neutral">Não existe no portal</Badge> : null}
          </h3>
          {state === 'confirmed' && confirmed ? (
            <RouteLine route={confirmed} />
          ) : state === 'suggested' && suggestion ? (
            <>
              <RouteLine route={suggestion} prefix="Sugestão:" />
              {alternatives.length > 0 ? (
                <p className="text-label text-text-muted">
                  {alternatives.length === 1
                    ? 'Há mais 1 candidata em “Outras opções”.'
                    : `Há mais ${alternatives.length} candidatas em “Outras opções”.`}
                </p>
              ) : null}
            </>
          ) : state === 'absent' && absence ? (
            <p className="text-label text-text-muted">Procurado em: {absence.reason}</p>
          ) : (
            <p className="text-label text-text-muted">A descoberta não sugeriu nenhuma URL.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state === 'suggested' && suggestion ? (
            <Button
              className="min-h-9 px-3"
              disabled={pending}
              aria-label={`Confirmar ${displayUrl(suggestion.url)} para ${label}`}
              onClick={() => confirm(suggestion.id)}
            >
              Confirmar
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="min-h-9 px-3"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${toggleText}: ${label}`}
            onClick={() => setOpen((o) => !o)}
          >
            {toggleText}
          </Button>
        </div>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="motion-safe:animate-enter flex flex-col divide-y divide-border rounded-md border border-border bg-canvas"
      >
        {alternatives.length + others.length > 0 ? (
          <form
            className="flex flex-wrap items-end gap-3 p-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (choice !== '') confirm(choice);
            }}
          >
            <label className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5 text-label font-medium">
              Usar outra URL descoberta
              <select
                value={choice}
                onChange={(event) =>
                  setChoice(event.target.value === '' ? '' : Number(event.target.value))
                }
                className="min-h-10 w-full rounded-md border border-border-strong bg-surface px-2 font-normal"
              >
                <option value="">Escolha uma URL</option>
                {alternatives.length > 0 ? (
                  <optgroup label={`Sugeridas para ${label}`}>
                    {alternatives.map((route) => (
                      <option key={route.id} value={route.id}>
                        {optionText(route)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {others.length > 0 ? (
                  <optgroup label="Outras URLs do portal">
                    {others.map((route) => (
                      <option key={route.id} value={route.id}>
                        {optionText(route)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <Button type="submit" variant="secondary" disabled={choice === '' || pending}>
              Usar esta URL
            </Button>
          </form>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-3 p-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate(
              { url: manualUrl, functionKey, replaceConfirmed: true },
              { onSuccess: done },
            );
          }}
        >
          <TextField
            label="Informar a URL"
            type="url"
            placeholder="https://"
            value={manualUrl}
            onChange={(event) => setManualUrl(event.target.value)}
            className="min-w-0 flex-1 basis-72"
          />
          <Button type="submit" variant="secondary" disabled={manualUrl.trim() === '' || pending}>
            Usar URL informada
          </Button>
        </form>

        {state === 'absent' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-label text-text-muted">
              Marcada como inexistente. Desfazer volta a função para a revisão.
            </p>
            <Button
              variant="secondary"
              disabled={clearAbsence.isPending}
              onClick={() => clearAbsence.mutate(functionKey, { onSuccess: done })}
            >
              Desfazer
            </Button>
          </div>
        ) : state !== 'confirmed' ? (
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              markAbsent.mutate({ functionKey, reason }, { onSuccess: done });
            }}
          >
            <label className="flex flex-col gap-1.5 text-label font-medium">
              O portal não tem esta página? Diga onde procurou.
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="rounded-md border border-border-strong bg-surface px-3 py-2 text-body font-normal"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="secondary"
                disabled={reason.trim().length < 10 || pending}
              >
                Registrar que não existe
              </Button>
              <span className="text-label text-text-muted">
                Entra na cobertura do portal, nunca como 0%.
              </span>
            </div>
          </form>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-label text-critical-text">
          {errorMessage(error)}
        </p>
      ) : null}
    </li>
  );
}

function RouteLine({ route, prefix }: { route: Route; prefix?: string }) {
  const caption = routeCaption(route);
  return (
    <p className="flex flex-col text-label text-text-muted">
      <span>
        {prefix ? `${prefix} ` : null}
        <span className="font-mono text-code break-all text-text">{displayUrl(route.url)}</span>
      </span>
      {caption ? <span>{caption}</span> : null}
    </p>
  );
}
