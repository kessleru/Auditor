import {
  type AuthUser,
  authUserResponseSchema,
  type LoginRequest,
  loginRequestSchema,
} from '@auditoria-rf/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, buttonClasses, Logo, PageTitle, SkipLink, TextField } from '../../components/ui';
import { ApiError, apiRequest } from '../../lib/api';
import { useMethodology } from '../results/api';
import { PasswordField } from './PasswordField';
import { auditorQueryKey, useAuditor } from './useAuditor';

/** Só aceita caminhos internos em `?voltar=` (nada de redirecionamento para fora). */
export function safeReturnPath(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/painel';
}

/** Ilustração decorativa do painel de marca: um portal com um achado e a barra de conformidade. */
function BrandIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden max-w-md lg:block">
      <div className="rounded-lg bg-surface p-4 shadow-float">
        <div className="mb-4 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-critical-soft" />
          <span className="size-2.5 rounded-full bg-warn-soft" />
          <span className="size-2.5 rounded-full bg-ok-soft" />
          <span className="ml-2 h-5 flex-1 rounded-sm bg-muted" />
        </div>
        <div className="mb-2 h-3 w-2/3 rounded-full bg-text" />
        <div className="mb-2 h-2 w-full rounded-full bg-muted" />
        <div className="mb-4 h-2 w-4/5 rounded-full bg-muted" />
        <div className="flex gap-3">
          <div className="h-16 w-2/5 rounded-md bg-accent-soft" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-2 w-full rounded-full bg-muted" />
            <div className="h-2 w-2/3 rounded-full bg-muted" />
            <div className="mt-1 h-7 w-3/5 rounded-md bg-accent outline-2 outline-offset-2 outline-accent" />
          </div>
        </div>
      </div>
      <div className="absolute -right-10 -bottom-10 w-60 rounded-lg bg-surface p-4 shadow-float">
        <div className="mb-2 h-2 w-1/2 rounded-full bg-muted" />
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-4/5 rounded-full bg-ok" />
          </div>
          <div className="h-2 w-8 rounded-full bg-text" />
        </div>
      </div>
    </div>
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
      <header className="flex flex-col gap-6 bg-gradient-to-br from-accent to-[#0f2c66] px-6 py-6 text-white lg:w-[47%] lg:justify-between lg:px-12 lg:py-10">
        <Link to="/" aria-label="Auditoria RF — início" className="self-start rounded-md">
          <Logo tone="inverse" />
        </Link>
        <div className="flex flex-col gap-4">
          <p className="max-w-lg text-[1.375rem] leading-tight font-semibold lg:text-[2.25rem]">
            Portais públicos acessíveis para todos os estudantes.
          </p>
          <p className="hidden max-w-lg text-body text-white/90 lg:block">
            Auditoria automatizada e inspeção manual de acessibilidade e usabilidade nos portais dos
            Institutos Federais.
          </p>
        </div>
        <BrandIllustration />
        <p className="hidden text-label text-white/90 lg:block">
          Projeto de TCC · Ciência da Computação · IFTM
        </p>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center bg-surface px-6 py-10 lg:items-center"
      >
        <div className="flex w-full max-w-[400px] flex-col gap-6">
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
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          <div className="flex items-center gap-3 text-label text-text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Link to="/" className={buttonClasses('secondary', 'min-h-11 w-full')}>
            Ver resultados públicos sem entrar
          </Link>

          <p className="text-center text-label text-text-muted">
            Problemas para acessar? Fale com o{' '}
            {methodology?.contactEmail ? (
              <a
                href={`mailto:${methodology.contactEmail}`}
                className="text-accent underline underline-offset-2"
              >
                responsável pela pesquisa
              </a>
            ) : (
              'responsável pela pesquisa'
            )}
            .
          </p>
        </div>
      </main>
    </div>
  );
}
