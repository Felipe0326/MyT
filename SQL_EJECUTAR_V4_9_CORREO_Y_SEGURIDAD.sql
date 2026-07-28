-- =====================================================================
-- SISTEMA MOVILIDAD Y TRANSPORTE V4.9
-- EJECUTAR UNA SOLA VEZ EN EL SQL EDITOR DE SUPABASE
-- Este archivo es acumulativo: incluye V4.8 (recuperación) y V4.9
-- (límites de intentos). No elimina usuarios ni datos existentes.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Restablecimiento seguro de contraseñas (incluido desde V4.8)
-- ---------------------------------------------------------------------

create table if not exists public.password_reset_tokens_tym (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles_tym(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pendiente',
  expires_at timestamptz not null,
  sent_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_email_lowercase check (email = lower(email)),
  constraint password_reset_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint password_reset_status_valid check (
    status in ('pendiente', 'usado', 'expirado', 'revocado')
  ),
  constraint password_reset_expiration_valid check (expires_at > created_at)
);

create index if not exists password_reset_user_status_idx
  on public.password_reset_tokens_tym(user_id, status, created_at desc);
create index if not exists password_reset_expiration_idx
  on public.password_reset_tokens_tym(status, expires_at);

alter table public.password_reset_tokens_tym enable row level security;
revoke all on public.password_reset_tokens_tym from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Limitación distribuida y atómica de intentos (V4.9)
-- ---------------------------------------------------------------------

create table if not exists public.app_rate_limits_tym (
  key_hash text primary key,
  scope text not null,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint app_rate_limits_hash_format check (key_hash ~ '^[a-f0-9]{64}$'),
  constraint app_rate_limits_scope_valid check (
    length(scope) between 1 and 80 and scope ~ '^[A-Za-z0-9:_-]+$'
  ),
  constraint app_rate_limits_attempts_valid check (attempts >= 0)
);

create index if not exists app_rate_limits_tym_updated_idx
  on public.app_rate_limits_tym(updated_at);

alter table public.app_rate_limits_tym enable row level security;
revoke all on public.app_rate_limits_tym from public, anon, authenticated;

create or replace function public.consume_rate_limit_tym(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.app_rate_limits_tym%rowtype;
  v_attempts integer;
  v_window_started_at timestamptz;
  v_blocked_until timestamptz;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$'
    or p_scope !~ '^[A-Za-z0-9:_-]{1,80}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400
    or p_block_seconds not between 1 and 86400 then
    raise exception 'Parámetros de límite inválidos';
  end if;

  insert into public.app_rate_limits_tym (
    key_hash,
    scope,
    attempts,
    window_started_at,
    updated_at
  )
  values (p_key_hash, p_scope, 0, v_now, v_now)
  on conflict (key_hash) do nothing;

  select *
    into v_row
    from public.app_rate_limits_tym
   where key_hash = p_key_hash
   for update;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    update public.app_rate_limits_tym
       set updated_at = v_now
     where key_hash = p_key_hash;

    return query
      select
        false,
        greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer),
        0;
    return;
  end if;

  if v_now >= v_row.window_started_at + make_interval(secs => p_window_seconds) then
    v_attempts := 1;
    v_window_started_at := v_now;
  else
    v_attempts := v_row.attempts + 1;
    v_window_started_at := v_row.window_started_at;
  end if;

  if v_attempts > p_limit then
    v_blocked_until := v_now + make_interval(secs => p_block_seconds);
    update public.app_rate_limits_tym
       set attempts = v_attempts,
           window_started_at = v_window_started_at,
           blocked_until = v_blocked_until,
           updated_at = v_now
     where key_hash = p_key_hash;

    return query select false, p_block_seconds, 0;
    return;
  end if;

  update public.app_rate_limits_tym
     set attempts = v_attempts,
         window_started_at = v_window_started_at,
         blocked_until = null,
         updated_at = v_now
   where key_hash = p_key_hash;

  return query select true, 0, greatest(0, p_limit - v_attempts);
end;
$$;

revoke all on function public.consume_rate_limit_tym(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit_tym(text, text, integer, integer, integer)
  to service_role;

create or replace function public.reset_rate_limit_tym(p_key_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de límite inválido';
  end if;
  delete from public.app_rate_limits_tym where key_hash = p_key_hash;
end;
$$;

revoke all on function public.reset_rate_limit_tym(text) from public, anon, authenticated;
grant execute on function public.reset_rate_limit_tym(text) to service_role;

create or replace function public.cleanup_rate_limits_tym()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.app_rate_limits_tym
   where updated_at < clock_timestamp() - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_rate_limits_tym() from public, anon, authenticated;
grant execute on function public.cleanup_rate_limits_tym() to service_role;

commit;

-- Verificación opcional: debe devolver las dos tablas.
select to_regclass('public.password_reset_tokens_tym') as password_resets,
       to_regclass('public.app_rate_limits_tym') as rate_limits;
