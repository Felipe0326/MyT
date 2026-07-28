-- V4.8: restablecimiento seguro de contraseñas para Movilidad y Transporte.
-- Conserva todos los usuarios y datos existentes.

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

-- Los tokens sólo se administran desde rutas de servidor con service_role.
-- Ningún usuario puede leer sus hashes desde el navegador.
revoke all on public.password_reset_tokens_tym from anon, authenticated;
