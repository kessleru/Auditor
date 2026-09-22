import {
  type AuthUser,
  authUserResponseSchema,
  type LoginRequest,
  loginRequestSchema,
} from '@auditoria-rf/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, Logo, PageTitle, SkipLink, TextField } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useMethodology, usePublicSummary } from '../results/api';
import { PasswordField } from './PasswordField';
import { auditorQueryKey, useAuditor } from './useAuditor';

/** Só aceita caminhos internos em `?voltar=` (nada de redirecionamento para fora). */
export function safeReturnPath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/painel';
}

/**
 * Ilustração decorativa (aria-hidden): uma página auditada em que o anel de foco se desenha, o
 * selo de achados aparece e a barra de conformidade se preenche. Animações únicas, sob motion-safe.
 */
function BrandIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden w-full max-w-md pb-20 lg:block">
      <div className="rounded-lg bg-surface p-4 shadow-float motion-safe:animate-brand-rise">
        <div className="mb-4 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#e8a39e]" />
          <span className="size-2.5 rounded-full bg-[#e9c98f]" />
          <span className="size-2.5 rounded-full bg-[#9fd1b7]" />
          <span className="ml-2 flex h-6 flex-1 items-center rounded-sm bg-muted px-2 font-mono text-[0.8125rem] text-text-muted">
            iftm.edu.br/ingresso
          </span>
        </div>
        <div className="mb-2 h-3 w-2/3 rounded-full bg-text" />
        <div className="mb-2 h-2 w-full rounded-full bg-muted" />
        <div className="mb-4 h-2 w-4/5 rounded-full bg-muted" />
        <div className="flex gap-3">
          <div className="flex h-20 w-2/5 items-start rounded-md bg-accent-soft p-2">
            <span className="rounded-sm bg-ok-soft px-1.5 text-[0.8125rem] font-medium text-ok-text">
              alt ✓
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-2 w-full rounded-full bg-muted" />
            <div className="h-2 w-2/3 rounded-full bg-muted" />
            <div className="relative mt-2 w-fit">
              <span className="absolute -inset-1 rounded-lg border-2 border-accent motion-safe:animate-brand-ring" />
              <span className="relative block rounded-md bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-white">
                Inscrever-se
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-[-2rem] bottom-0 w-64 rounded-lg bg-surface p-4 shadow-float motion-safe:animate-brand-rise">
        <p className="mb-2 text-[0.8125rem] text-text-muted">Conformidade do portal (exemplo)</p>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[78%] origin-left rounded-full bg-ok motion-safe:animate-brand-fill" />
          </div>
          <span className="text-[0.8125rem] font-medium text-text">78%</span>
          <span className="text-[0.8125rem] text-text-muted">Bom</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Números reais da última coleta, quando existem. Em texto sobre o fundo da marca, separados por
 * uma divisória fina — cartões de vidro sobre o gradiente pesariam sem informar mais.
 */
function BrandStats() {
  const { data } = usePublicSummary();
  if (!data || data.institutionsEvaluated === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-white/20 pt-5 motion-safe:animate-brand-rise">
      <div className="flex flex-col gap-0.5">
        <dt className="text-label text-white/80">Portais avaliados</dt>
        <dd className="text-metric text-white tabular-nums">{data.institutionsEvaluated}</dd>
      </div>
      <div className="flex flex-col gap-0.5">
        <dt className="text-label text-white/80">Última coleta</dt>
        <dd className="text-metric text-white tabular-nums">
          {data.lastCollectionAt ? formatDate(data.lastCollectionAt) : '—'}
        </dd>
      </div>
    </dl>
  );
}

/** Tela 0.1: entrar como auditor. */
export function LoginPage() {
  const { data: auditor, isPending: checkingSession } = useAuditor();
  const { data: methodology } = useMethodology();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const returnTo = safeReturnPath(searchParams.get('voltar'));

  // Leva o foco à mensagem de erro para que o leitor de tela a anuncie.
  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  if (!checkingSession && auditor) return <Navigate to={returnTo} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user } = await apiRequest('/auth/login', {
        method: 'POST',
        body: values,
        schema: authUserResponseSchema,
      });
      queryClient.setQueryData<AuthUser | null>(auditorQueryKey, user);
      await navigate(returnTo, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível entrar agora. Tente de novo em instantes.',
      );
    }
  });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <SkipLink />
      <header className="relative isolate flex flex-col gap-6 overflow-hidden bg-[#143a82] px-6 py-6 text-white lg:w-[47%] lg:justify-between lg:gap-10 lg:px-12 lg:py-10">
        {/* Fundo decorativo: um gradiente só, com um brilho no canto de cima. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,#2a62c9_0%,transparent_60%),linear-gradient(160deg,#1f4fa8_0%,#0f2c66_100%)]"
        />
        <Link to="/" aria-label="Auditoria RF — início" className="self-start rounded-md">
          <Logo tone="inverse" />
        </Link>
        <div className="flex flex-col gap-4 motion-safe:animate-brand-rise">
          <p className="max-w-lg text-[1.375rem] leading-tight font-semibold tracking-tight lg:text-[2.5rem]">
            Portais públicos acessíveis para todos os estudantes.
          </p>
          <p className="hidden max-w-lg text-body text-white/90 lg:block">
            Auditoria automatizada e inspeção manual de acessibilidade e usabilidade nos portais dos
            Institutos Federais.
          </p>
        </div>
        <div className="hidden flex-col gap-10 lg:flex">
          <BrandStats />
          <BrandIllustration />
        </div>
        <p className="hidden text-label text-white/85 lg:block">
          Projeto de TCC · Ciência da Computação · IFTM
        </p>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center bg-surface px-6 py-10 lg:items-center"
      >
        <div className="flex w-full max-w-[400px] flex-col gap-6 motion-safe:animate-brand-rise">
          <div className="flex flex-col gap-2">
            <PageTitle>Entrar como auditor</PageTitle>
            <p className="text-body text-text-muted">
              Acesso da equipe de auditoria. Para consultar os resultados, não é preciso ter conta.
            </p>
          </div>

          {formError ? (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-md border border-critical bg-critical-soft px-4 py-3 text-body text-critical-text"
            >
              {formError}
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <TextField
              label="E-mail institucional"
              type="email"
              autoComplete="username"
              placeholder="nome.sobrenome@iftm.edu.br"
              error={errors.email?.message}
              {...register('email')}
            />
            <PasswordField
              label="Senha"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" disabled={isSubmitting} className="min-h-11 w-full">
              {isSubmitting ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    size={16}
                    strokeWidth={1.75}
                    className="motion-safe:animate-spin"
                  />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="flex flex-col gap-2 border-t border-border pt-5 text-label text-text-muted">
            <p>
              Os resultados são públicos.{' '}
              <Link
                to="/"
                className="font-medium text-accent-text underline underline-offset-2 hover:decoration-2"
              >
                Consultar sem entrar
              </Link>
              .
            </p>
            <p>
              Problemas para acessar? Fale com o{' '}
              {methodology?.contactEmail ? (
                <a
                  href={`mailto:${methodology.contactEmail}`}
                  className="text-accent-text underline underline-offset-2 hover:decoration-2"
                >
                  responsável pela pesquisa
                </a>
              ) : (
                'responsável pela pesquisa'
              )}
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
