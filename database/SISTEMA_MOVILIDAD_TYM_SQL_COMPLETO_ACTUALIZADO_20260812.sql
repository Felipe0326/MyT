-- =============================================================================
-- SISTEMA DE MOVILIDAD Y TRANSPORTE TYM
-- SQL COMPLETO CONSOLIDADO PARA SUPABASE
-- Fecha de consolidación: 2026-08-12
--
-- Alcance:
--   * usuarios, roles, secciones, permisos e invitaciones;
--   * sesiones, auditoría, recuperación de contraseña y rate limiting;
--   * NPS, Refrendos y Licencias;
--   * recaudación mensual y tabla diaria preparada;
--   * bitácora SMTP/Resend;
--   * vistas, RPC, índices, triggers, RLS y privilegios.
--
-- El archivo es acumulativo e idempotente para el esquema conocido. No contiene
-- credenciales ni elimina registros de negocio. Las sentencias CREATE OR REPLACE
-- actualizan las vistas y funciones que consume el código vigente.
-- =============================================================================


-- =============================================================================
-- 01. Usuarios, permisos, sesiones, auditoría y NPS base
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202607220001_initial_schema.sql
-- =============================================================================

-- Sistema de Movilidad y Transporte / Gobierno de Morelos
-- Ejecutar con Supabase CLI o desde el SQL Editor de un proyecto de desarrollo.
-- Todas las políticas son "deny by default" y la llave secreta nunca debe usarse en el navegador.

create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.app_role as enum ('administrador', 'editor', 'consulta');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('activo', 'inactivo');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.invitation_status as enum ('pendiente', 'aceptada', 'expirada', 'revocada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.section_availability as enum ('disponible', 'proximamente');
exception when duplicate_object then null;
end $$;

-- Usamos el sufijo `_tym` en todas las tablas para aislar e identificar el
-- módulo Trámites y Movilidad. La tabla genérica `public.profiles`, si existe,
-- permanece intacta. Solo se inscriben en TyM usuarios identificados para este sistema.
create table if not exists public.profiles_tym (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles_tym add column if not exists email text;
alter table public.profiles_tym add column if not exists full_name text;
alter table public.profiles_tym add column if not exists role public.app_role;
alter table public.profiles_tym add column if not exists status public.account_status;
alter table public.profiles_tym add column if not exists created_at timestamptz;
alter table public.profiles_tym add column if not exists updated_at timestamptz;

-- Auth es la fuente de verdad del correo. Esto también corrige mayúsculas y
-- completa la columna recién agregada para los usuarios que ya existían.
update public.profiles_tym as profile
set email = lower(auth_user.email)
from auth.users as auth_user
where auth_user.id = profile.id
  and auth_user.email is not null
  and profile.email is distinct from lower(auth_user.email);

-- Un perfil huérfano no debe impedir la migración. Se usa un identificador
-- interno no entregable hasta que el administrador regularice ese registro.
update public.profiles_tym
set email = 'sin-correo-' || id::text || '@invalid.local'
where email is null or btrim(email) = '';

update public.profiles_tym as profile
set full_name = coalesce(
  nullif(btrim(profile.full_name), ''),
  nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
  nullif(btrim(auth_user.raw_user_meta_data ->> 'name'), ''),
  split_part(profile.email, '@', 1),
  'Usuario'
)
from auth.users as auth_user
where auth_user.id = profile.id
  and (profile.full_name is null or btrim(profile.full_name) = '');

update public.profiles_tym
set full_name = coalesce(nullif(split_part(email, '@', 1), ''), 'Usuario')
where full_name is null or btrim(full_name) = '';

update public.profiles_tym set role = 'consulta' where role is null;
update public.profiles_tym set status = 'activo' where status is null;
update public.profiles_tym set created_at = now() where created_at is null;
update public.profiles_tym set updated_at = now() where updated_at is null;

alter table public.profiles_tym alter column email set not null;
alter table public.profiles_tym alter column full_name set not null;
alter table public.profiles_tym alter column full_name set default 'Usuario';
alter table public.profiles_tym alter column role set not null;
alter table public.profiles_tym alter column role set default 'consulta';
alter table public.profiles_tym alter column status set not null;
alter table public.profiles_tym alter column status set default 'activo';
alter table public.profiles_tym alter column created_at set not null;
alter table public.profiles_tym alter column created_at set default now();
alter table public.profiles_tym alter column updated_at set not null;
alter table public.profiles_tym alter column updated_at set default now();

create unique index if not exists profiles_tym_email_unique_idx on public.profiles_tym (lower(email));

create table if not exists public.app_sections_tym (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  icon text not null default 'layout-dashboard',
  sort_order integer not null default 0,
  availability public.section_availability not null default 'proximamente',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_sections_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.user_section_permissions_tym (
  user_id uuid not null references public.profiles_tym(id) on delete cascade,
  section_id uuid not null references public.app_sections_tym(id) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  can_export boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, section_id)
);
create index if not exists user_section_permissions_tym_section_idx on public.user_section_permissions_tym(section_id, user_id);

create table if not exists public.invitations_tym (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role public.app_role not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'pendiente',
  expires_at timestamptz not null,
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  send_count integer not null default 1,
  created_by uuid references public.profiles_tym(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email)),
  constraint invitations_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint invitations_send_count_positive check (send_count >= 1)
);
create unique index if not exists invitations_tym_one_pending_email_idx
  on public.invitations_tym(lower(email)) where status = 'pendiente';
create index if not exists invitations_tym_status_expires_idx on public.invitations_tym(status, expires_at);

create table if not exists public.invitation_section_permissions_tym (
  invitation_id uuid not null references public.invitations_tym(id) on delete cascade,
  section_id uuid not null references public.app_sections_tym(id) on delete cascade,
  primary key (invitation_id, section_id)
);

create table if not exists public.app_sessions_tym (
  session_id uuid primary key,
  user_id uuid not null references public.profiles_tym(id) on delete cascade,
  last_activity_at timestamptz not null default now(),
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint app_sessions_absolute_after_created check (absolute_expires_at > created_at)
);
create index if not exists app_sessions_tym_user_active_idx on public.app_sessions_tym(user_id, revoked_at, last_activity_at desc);

create table if not exists public.audit_logs_tym (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);
create index if not exists audit_logs_tym_actor_created_idx on public.audit_logs_tym(actor_user_id, created_at desc);
create index if not exists audit_logs_tym_action_created_idx on public.audit_logs_tym(action, created_at desc);

create table if not exists public.data_imports_tym (
  id uuid primary key default gen_random_uuid(),
  dashboard_slug text not null references public.app_sections_tym(slug),
  source_filename text not null,
  source_sha256 text not null,
  row_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  status text not null default 'procesando' check (status in ('procesando', 'completado', 'fallido')),
  error_message text,
  imported_by uuid references public.profiles_tym(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (dashboard_slug, source_sha256)
);

create table if not exists public.nps_responses_tym (
  submit_id bigint primary key,
  booking_id bigint,
  form_id bigint,
  survey_name text not null default 'Encuesta NPS',
  team_id bigint,
  dependencia text not null,
  team_branch_id bigint,
  sucursal_branch text not null,
  booking_folio text,
  booking_status text,
  start_at timestamptz,
  end_at timestamptz,
  check_in_at timestamptz,
  check_out_at timestamptz,
  entity_id bigint,
  entity_type text,
  survey_submitted_at timestamptz not null,
  booking_created_at timestamptz,
  comentario_libre text not null default '',
  recomienda_citas boolean not null,
  estrellas_facilidad_uso smallint,
  estrellas_trato_personal smallint not null,
  import_id uuid references public.data_imports_tym(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nps_survey_name_length check (char_length(survey_name) between 1 and 250),
  constraint nps_booking_folio_length check (booking_folio is null or char_length(booking_folio) <= 100),
  constraint nps_booking_status_length check (booking_status is null or char_length(booking_status) <= 100),
  constraint nps_entity_type_length check (entity_type is null or char_length(entity_type) <= 100),
  constraint nps_facilidad_range check (estrellas_facilidad_uso between 0 and 5),
  constraint nps_trato_range check (estrellas_trato_personal between 0 and 5),
  constraint nps_dependencia_length check (char_length(dependencia) between 1 and 250),
  constraint nps_sucursal_length check (char_length(sucursal_branch) between 1 and 250),
  constraint nps_comment_length check (char_length(comentario_libre) <= 10000)
);
alter table public.nps_responses_tym add column if not exists survey_name text not null default 'Encuesta NPS';
create index if not exists nps_responses_tym_submitted_idx on public.nps_responses_tym(survey_submitted_at desc);
create index if not exists nps_responses_tym_survey_name_idx on public.nps_responses_tym(survey_name);
create index if not exists nps_responses_tym_booking_id_idx on public.nps_responses_tym(booking_id);
create index if not exists nps_responses_tym_form_id_idx on public.nps_responses_tym(form_id);
create index if not exists nps_responses_tym_dependencia_date_idx on public.nps_responses_tym(dependencia, survey_submitted_at desc);
create index if not exists nps_responses_tym_sucursal_date_idx on public.nps_responses_tym(sucursal_branch, survey_submitted_at desc);

create or replace function public.set_updated_at_tym()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_tym_set_updated_at on public.profiles_tym;
create trigger profiles_tym_set_updated_at before update on public.profiles_tym
for each row execute function public.set_updated_at_tym();
drop trigger if exists sections_tym_set_updated_at on public.app_sections_tym;
create trigger sections_tym_set_updated_at before update on public.app_sections_tym
for each row execute function public.set_updated_at_tym();
drop trigger if exists permissions_tym_set_updated_at on public.user_section_permissions_tym;
create trigger permissions_tym_set_updated_at before update on public.user_section_permissions_tym
for each row execute function public.set_updated_at_tym();
drop trigger if exists invitations_tym_set_updated_at on public.invitations_tym;
create trigger invitations_tym_set_updated_at before update on public.invitations_tym
for each row execute function public.set_updated_at_tym();
drop trigger if exists nps_responses_tym_set_updated_at on public.nps_responses_tym;
create trigger nps_responses_tym_set_updated_at before update on public.nps_responses_tym
for each row execute function public.set_updated_at_tym();

create or replace function public.handle_auth_user_profile_tym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- En un Supabase compartido, no copie automáticamente usuarios de otros sistemas.
  -- Los usuarios creados por esta aplicación llevan app_metadata.system_code = 'tym'.
  -- Un perfil ya inscrito manualmente puede seguir sincronizando su correo.
  if coalesce(new.raw_app_meta_data ->> 'system_code', '') <> 'tym'
     and not exists (select 1 from public.profiles_tym where id = new.id) then
    return new;
  end if;

  insert into public.profiles_tym (id, email, full_name, role, status)
  values (
    new.id,
    lower(coalesce(new.email, 'sin-correo-' || new.id::text || '@invalid.local')),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    'consulta'::public.app_role,
    'activo'::public.account_status
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles_tym.full_name = 'Usuario' then excluded.full_name else public.profiles_tym.full_name end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_tym on auth.users;
create trigger on_auth_user_created_tym
after insert or update of email on auth.users
for each row execute function public.handle_auth_user_profile_tym();

create or replace function public.is_active_user_tym(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles_tym p
    where p.id = p_user_id and p.status = 'activo'
  );
$$;

create or replace function public.is_admin_tym(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles_tym p
    where p.id = p_user_id and p.status = 'activo' and p.role = 'administrador'
  );
$$;

create or replace function public.has_section_permission_tym(
  p_user_id uuid,
  p_section_slug text,
  p_action text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles_tym p
    where p.id = p_user_id
      and p.status = 'activo'
      and (
        p.role = 'administrador'
        or exists (
          select 1
          from public.user_section_permissions_tym usp
          join public.app_sections_tym s on s.id = usp.section_id
          where usp.user_id = p.id
            and s.slug = p_section_slug
            and s.is_active
            and case p_action
              when 'view' then usp.can_view
              when 'edit' then usp.can_edit and p.role in ('editor', 'administrador')
              when 'export' then usp.can_export
              else false
            end
        )
      )
  );
$$;

create or replace function public.increment_invitation_send_count_tym(p_invitation_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invitations_tym
  set send_count = send_count + 1
  where id = p_invitation_id;
$$;

revoke all on function public.increment_invitation_send_count_tym(uuid) from public, anon, authenticated;
grant execute on function public.increment_invitation_send_count_tym(uuid) to service_role;

revoke all on function public.set_updated_at_tym() from public, anon, authenticated;
revoke all on function public.handle_auth_user_profile_tym() from public, anon, authenticated;
revoke all on function public.is_active_user_tym(uuid) from public, anon;
revoke all on function public.is_admin_tym(uuid) from public, anon;
revoke all on function public.has_section_permission_tym(uuid, text, text) from public, anon;
grant execute on function public.is_active_user_tym(uuid) to authenticated, service_role;
grant execute on function public.is_admin_tym(uuid) to authenticated, service_role;
grant execute on function public.has_section_permission_tym(uuid, text, text) to authenticated, service_role;

create or replace function public.get_nps_dashboard_tym(
  p_dependencia text default null,
  p_sucursal text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 10), 100);
begin
  if not public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'view') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with filtered as materialized (
    select r.*
    from public.nps_responses_tym r
    where (p_dependencia is null or r.dependencia = p_dependencia)
      and (p_sucursal is null or r.sucursal_branch = p_sucursal)
      and (p_date_from is null or r.survey_submitted_at >= p_date_from::timestamptz)
      and (p_date_to is null or r.survey_submitted_at < (p_date_to + 1)::timestamptz)
  ),
  metrics as (
    select
      count(*)::integer as total,
      coalesce(round(100.0 * sum(case when recomienda_citas then 1 else -1 end) / nullif(count(*), 0)), 0)::integer as nps,
      coalesce(round(avg(estrellas_facilidad_uso)::numeric, 1), 0) as facilidad,
      coalesce(round(avg(estrellas_trato_personal)::numeric, 1), 0) as trato,
      count(*) filter (where recomienda_citas)::integer as promotores,
      count(*) filter (where not recomienda_citas)::integer as detractores
    from filtered
  ),
  trend_rows as (
    select
      date_trunc('month', survey_submitted_at) as month_start,
      count(*)::integer as total,
      round(100.0 * sum(case when recomienda_citas then 1 else -1 end) / nullif(count(*), 0))::integer as nps
    from filtered
    group by 1
    order by 1
  ),
  comments_page as (
    select
      submit_id,
      survey_name,
      dependencia,
      sucursal_branch,
      survey_submitted_at,
      comentario_libre,
      recomienda_citas,
      estrellas_facilidad_uso,
      estrellas_trato_personal
    from filtered
    order by survey_submitted_at desc, submit_id desc
    limit v_page_size offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'metrics', (select to_jsonb(m) from metrics m),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object('month', to_char(t.month_start, 'YYYY-MM'), 'nps', t.nps, 'total', t.total)
        order by t.month_start
      ) from trend_rows t
    ), '[]'::jsonb),
    'dependencias', coalesce((
      select jsonb_agg(value order by value)
      from (select distinct dependencia as value from public.nps_responses_tym) d
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(value order by value)
      from (
        select distinct sucursal_branch as value
        from public.nps_responses_tym
        where p_dependencia is null or dependencia = p_dependencia
      ) s
    ), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.survey_submitted_at desc) from comments_page c), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total from metrics),
      'totalPages', greatest(1, ceil((select total from metrics)::numeric / v_page_size)::integer)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_nps_dashboard_tym(text, text, date, date, integer, integer) from public, anon;
grant execute on function public.get_nps_dashboard_tym(text, text, date, date, integer, integer) to authenticated;

alter table public.profiles_tym enable row level security;
alter table public.app_sections_tym enable row level security;
alter table public.user_section_permissions_tym enable row level security;
alter table public.invitations_tym enable row level security;
alter table public.invitation_section_permissions_tym enable row level security;
alter table public.app_sessions_tym enable row level security;
alter table public.audit_logs_tym enable row level security;
alter table public.data_imports_tym enable row level security;
alter table public.nps_responses_tym enable row level security;

drop policy if exists profiles_tym_read_own_or_admin on public.profiles_tym;
create policy profiles_tym_read_own_or_admin on public.profiles_tym
for select to authenticated
using (id = auth.uid() or public.is_admin_tym(auth.uid()));

drop policy if exists sections_tym_read_authorized on public.app_sections_tym;
create policy sections_tym_read_authorized on public.app_sections_tym
for select to authenticated
using (is_active and (public.is_admin_tym(auth.uid()) or public.has_section_permission_tym(auth.uid(), slug, 'view')));

drop policy if exists permissions_tym_read_own_or_admin on public.user_section_permissions_tym;
create policy permissions_tym_read_own_or_admin on public.user_section_permissions_tym
for select to authenticated
using (user_id = auth.uid() or public.is_admin_tym(auth.uid()));

drop policy if exists invitations_tym_admin_read on public.invitations_tym;
create policy invitations_tym_admin_read on public.invitations_tym
for select to authenticated
using (public.is_admin_tym(auth.uid()));

drop policy if exists invitation_permissions_tym_admin_read on public.invitation_section_permissions_tym;
create policy invitation_permissions_tym_admin_read on public.invitation_section_permissions_tym
for select to authenticated
using (public.is_admin_tym(auth.uid()));

drop policy if exists audit_tym_admin_read on public.audit_logs_tym;
create policy audit_tym_admin_read on public.audit_logs_tym
for select to authenticated
using (public.is_admin_tym(auth.uid()));

drop policy if exists imports_tym_authorized_read on public.data_imports_tym;
create policy imports_tym_authorized_read on public.data_imports_tym
for select to authenticated
using (public.has_section_permission_tym(auth.uid(), dashboard_slug, 'view'));

drop policy if exists nps_tym_authorized_read on public.nps_responses_tym;
create policy nps_tym_authorized_read on public.nps_responses_tym
for select to authenticated
using (public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'view'));

drop policy if exists nps_tym_editor_insert on public.nps_responses_tym;
create policy nps_tym_editor_insert on public.nps_responses_tym
for insert to authenticated
with check (public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'edit'));

drop policy if exists nps_tym_editor_update on public.nps_responses_tym;
create policy nps_tym_editor_update on public.nps_responses_tym
for update to authenticated
using (public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'edit'))
with check (public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'edit'));

revoke all on public.profiles_tym, public.app_sections_tym, public.user_section_permissions_tym,
  public.invitations_tym, public.invitation_section_permissions_tym, public.app_sessions_tym,
  public.audit_logs_tym, public.data_imports_tym, public.nps_responses_tym from anon;

grant select on public.profiles_tym, public.app_sections_tym, public.user_section_permissions_tym,
  public.invitations_tym, public.invitation_section_permissions_tym, public.audit_logs_tym,
  public.data_imports_tym, public.nps_responses_tym to authenticated;
grant insert, update on public.nps_responses_tym to authenticated;

insert into public.app_sections_tym (slug, title, description, icon, sort_order, availability, is_active)
values
  ('dashboard-nps', 'NPS', 'Indicadores de experiencia y satisfacción ciudadana.', 'activity', 10, 'disponible', true),
  ('dashboard-2', 'Refrendos', 'Consulta y seguimiento de datos de refrendos.', 'refresh-cw', 20, 'disponible', true),
  ('dashboard-3', 'Trámites', 'Consulta y seguimiento de datos de trámites.', 'file-text', 30, 'proximamente', true)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  availability = excluded.availability,
  is_active = excluded.is_active;

-- PRIMER ADMINISTRADOR
-- 1) Crear el usuario en Authentication > Users.
-- 2) Sustituir el correo y ejecutar una sola vez:
-- insert into public.profiles_tym (id, email, full_name, role, status)
-- select id, lower(email), coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1)),
--        'administrador', 'activo'
-- from auth.users where lower(email) = lower('administrador@morelos.gob.mx')
-- on conflict (id) do update set role = 'administrador', status = 'activo';

-- 3) El administrador ve todas las secciones sin necesitar filas en
--    user_section_permissions. Los demás usuarios reciben permisos al aceptar su invitación.


-- =============================================================================
-- 02. Tablas de Licencias, Refrendos, Recaudación y correo
-- Fuente consolidada: work/consolidated_sql_20260812/00_business_tables.sql
-- =============================================================================

-- =============================================================================
-- TABLAS DE NEGOCIO TYM
-- Se ejecuta después del esquema base de usuarios/permisos y antes de los RPC.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Licencias
-- -----------------------------------------------------------------------------
create table if not exists public.licencias_tramites_tym (
  id bigint generated always as identity primary key,
  fecha date not null,
  anio integer not null,
  mes text not null,
  dia_semana text not null,
  tipo_tramite_id integer not null default 0,
  tipo_tramite text not null,
  tipo_licencia_id integer not null default 0,
  tipo_licencia text not null,
  tramites_presenciales bigint not null default 0,
  tramites_en_linea bigint not null default 0,
  sin_clasificar bigint not null default 0,
  total_tramites bigint not null default 0,
  actualizado_en timestamptz not null default now(),
  constraint licencias_tramites_tym_unico
    unique (fecha, tipo_tramite_id, tipo_licencia_id),
  constraint licencias_tramites_tym_total_check check (
    total_tramites = tramites_presenciales + tramites_en_linea + sin_clasificar
  ),
  constraint licencias_tramites_tym_nonnegative_check check (
    tramites_presenciales >= 0 and tramites_en_linea >= 0
    and sin_clasificar >= 0 and total_tramites >= 0
  )
);

create index if not exists licencias_tramites_tym_fecha_idx
  on public.licencias_tramites_tym(fecha);
create index if not exists licencias_tramites_tym_fecha_tipos_idx
  on public.licencias_tramites_tym(fecha, tipo_tramite_id, tipo_licencia_id);

-- -----------------------------------------------------------------------------
-- Refrendos
-- -----------------------------------------------------------------------------
create table if not exists public.refrendo_diario (
  id bigserial primary key,
  fecha date not null,
  anio integer,
  mes integer,
  dia integer,
  dia_semana text,
  movimiento text,
  total_registros integer default 0,
  es_digital integer,
  es_tradicional integer,
  "Porcentaje_digital" numeric(5,2),
  "Porcentaje_Tradicional" numeric(5,2),
  resultado boolean,
  mensaje text,
  error integer default -1,
  created_at timestamp without time zone default now(),
  updated_at timestamptz default now(),
  hora integer,
  constraint refrendo_diario_hora_check check (hora is null or hora between 0 and 23),
  constraint refrendo_diario_mes_check check (mes is null or mes between 1 and 12),
  constraint refrendo_diario_dia_check check (dia is null or dia between 1 and 31),
  constraint refrendo_diario_counts_check check (
    coalesce(total_registros, 0) >= 0
    and coalesce(es_digital, 0) >= 0
    and coalesce(es_tradicional, 0) >= 0
  )
);

create index if not exists idx_refrendo_diario_fecha
  on public.refrendo_diario(fecha desc);
create index if not exists idx_refrendo_diario_anio_mes
  on public.refrendo_diario(anio, mes);
create index if not exists idx_refrendo_diario_movimiento
  on public.refrendo_diario(movimiento);
create index if not exists idx_refrendo_diario_created_at
  on public.refrendo_diario(created_at);
create unique index if not exists uq_refrendo_diario_fecha_hora_movimiento
  on public.refrendo_diario(fecha, hora, movimiento) nulls not distinct;
create index if not exists idx_refrendo_tym_dashboard_filters
  on public.refrendo_diario(anio, mes, fecha desc, hora, movimiento, id desc)
  include (total_registros, es_digital, es_tradicional);
create index if not exists idx_refrendo_tym_fecha_movimiento
  on public.refrendo_diario(fecha desc, movimiento, hora, id desc);

create or replace function public.sync_fecha_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.anio := extract(year from new.fecha)::integer;
  new.mes := extract(month from new.fecha)::integer;
  new.dia := extract(day from new.fecha)::integer;
  new.dia_semana := case extract(isodow from new.fecha)::integer
    when 1 then 'LUNES'
    when 2 then 'MARTES'
    when 3 then 'MIERCOLES'
    when 4 then 'JUEVES'
    when 5 then 'VIERNES'
    when 6 then 'SABADO'
    when 7 then 'DOMINGO'
  end;
  return new;
end;
$$;

-- Se conserva esta función por compatibilidad con instalaciones anteriores.
create or replace function public.update_refrendo_diario_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trigger_sync_fecha_columns on public.refrendo_diario;
create trigger trigger_sync_fecha_columns
before insert or update of fecha on public.refrendo_diario
for each row execute function public.sync_fecha_columns();

-- Un solo trigger de updated_at; evita actualizaciones duplicadas.
drop trigger if exists trigger_refrendo_diario_updated_at on public.refrendo_diario;
drop trigger if exists refrendo_diario_set_updated_at on public.refrendo_diario;
create trigger refrendo_diario_set_updated_at
before update on public.refrendo_diario
for each row execute function public.set_updated_at_tym();

-- -----------------------------------------------------------------------------
-- Recaudación mensual
-- -----------------------------------------------------------------------------
create table if not exists public.recaudacion_licencias_tym (
  id bigint generated by default as identity primary key,
  anio smallint not null,
  mes smallint not null,
  periodo date generated always as (make_date(anio::integer, mes::integer, 1)) stored,
  cri text not null default '4.3.4.13',
  concepto text not null,
  monto_proyectado numeric(18,2),
  monto_recaudado numeric(18,2),
  fecha_corte date,
  observacion text,
  fuente text not null default 'carga_manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recaudacion_licencias_tym_periodo_cri_uk unique (anio, mes, cri),
  constraint recaudacion_licencias_tym_mes_chk check (mes between 1 and 12),
  constraint recaudacion_licencias_tym_anio_chk check (anio between 2000 and 2200),
  constraint recaudacion_licencias_tym_importes_chk check (
    monto_proyectado is not null or monto_recaudado is not null
  ),
  constraint recaudacion_licencias_tym_proyectado_chk check (
    monto_proyectado is null or monto_proyectado >= 0
  ),
  constraint recaudacion_licencias_tym_recaudado_chk check (
    monto_recaudado is null or monto_recaudado >= 0
  )
);

create index if not exists idx_recaudacion_licencias_tym_periodo
  on public.recaudacion_licencias_tym(periodo);
drop trigger if exists trg_recaudacion_licencias_tym_updated_at
  on public.recaudacion_licencias_tym;
create trigger trg_recaudacion_licencias_tym_updated_at
before update on public.recaudacion_licencias_tym
for each row execute function public.set_updated_at_tym();

create table if not exists public.recaudacion_refrendo_tym (
  id bigint generated by default as identity primary key,
  anio smallint not null,
  mes smallint not null,
  periodo date generated always as (make_date(anio::integer, mes::integer, 1)) stored,
  cri text not null default '4.3.4.2',
  concepto text not null,
  monto_proyectado numeric(18,2),
  monto_fecha_pago numeric(18,2),
  monto_recaudado numeric(18,2),
  fecha_corte date,
  observacion text,
  fuente text not null default 'carga_manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recaudacion_refrendo_tym_periodo_cri_uk unique (anio, mes, cri),
  constraint recaudacion_refrendo_tym_mes_chk check (mes between 1 and 12),
  constraint recaudacion_refrendo_tym_anio_chk check (anio between 2000 and 2200),
  constraint recaudacion_refrendo_tym_importes_chk check (
    monto_proyectado is not null or monto_fecha_pago is not null
    or monto_recaudado is not null
  ),
  constraint recaudacion_refrendo_tym_proyectado_chk check (
    monto_proyectado is null or monto_proyectado >= 0
  ),
  constraint recaudacion_refrendo_tym_fecha_pago_chk check (
    monto_fecha_pago is null or monto_fecha_pago >= 0
  ),
  constraint recaudacion_refrendo_tym_recaudado_chk check (
    monto_recaudado is null or monto_recaudado >= 0
  )
);

create index if not exists idx_recaudacion_refrendo_tym_periodo
  on public.recaudacion_refrendo_tym(periodo);
drop trigger if exists trg_recaudacion_refrendo_tym_updated_at
  on public.recaudacion_refrendo_tym;
create trigger trg_recaudacion_refrendo_tym_updated_at
before update on public.recaudacion_refrendo_tym
for each row execute function public.set_updated_at_tym();

-- Recaudación diaria particular/público preparada para la futura gráfica.
create table if not exists public.recaudacion_refrendo_diaria_tym (
  id bigint generated by default as identity primary key,
  concepto text not null,
  fecha date not null,
  monto numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recaudacion_refrendo_diaria_unica unique (concepto, fecha),
  constraint recaudacion_refrendo_diaria_monto_check check (monto >= 0)
);

create index if not exists recaudacion_refrendo_diaria_fecha_idx
  on public.recaudacion_refrendo_diaria_tym(fecha desc, concepto);
drop trigger if exists recaudacion_refrendo_diaria_set_updated_at
  on public.recaudacion_refrendo_diaria_tym;
create trigger recaudacion_refrendo_diaria_set_updated_at
before update on public.recaudacion_refrendo_diaria_tym
for each row execute function public.set_updated_at_tym();

-- -----------------------------------------------------------------------------
-- Bitácora de entrega de correo
-- -----------------------------------------------------------------------------
create table if not exists public.email_delivery_logs_tym (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  recipient text not null,
  provider text not null,
  smtp_host text,
  smtp_port integer,
  smtp_secure boolean,
  attempt_name text,
  used_fallback boolean not null default false,
  success boolean not null,
  smtp_code integer,
  smtp_response text,
  message_id text,
  accepted jsonb not null default '[]'::jsonb,
  rejected jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  final_attempt boolean not null default true,
  created_at timestamptz not null default now(),
  constraint email_delivery_provider_valid check (
    provider in ('smtp', 'resend', 'manual')
  ),
  constraint email_delivery_attempt_valid check (
    attempt_name is null or attempt_name in ('primary-587', 'fallback-465')
  ),
  constraint email_delivery_category_valid check (
    category in ('invitation', 'password_reset')
  ),
  constraint email_delivery_smtp_code_valid check (
    smtp_code is null or smtp_code between 100 and 599
  ),
  constraint email_delivery_recipient_lowercase check (recipient = lower(recipient)),
  constraint email_delivery_port_valid check (
    smtp_port is null or smtp_port between 1 and 65535
  )
);

create index if not exists email_delivery_logs_created_idx
  on public.email_delivery_logs_tym(created_at desc);
create index if not exists email_delivery_logs_recipient_created_idx
  on public.email_delivery_logs_tym(recipient, created_at desc);
create index if not exists email_delivery_logs_failure_created_idx
  on public.email_delivery_logs_tym(success, created_at desc);

-- -----------------------------------------------------------------------------
-- Secciones del portal
-- -----------------------------------------------------------------------------
insert into public.app_sections_tym
  (slug, title, description, icon, sort_order, availability, is_active)
values
  ('dashboard-nps', 'NPS', 'Indicadores de experiencia y satisfacción ciudadana.', 'activity', 10, 'disponible', true),
  ('dashboard-2', 'Refrendos', 'Consulta y seguimiento de datos de refrendos.', 'refresh-cw', 20, 'disponible', true),
  ('dashboard-licencias', 'Licencias', 'Consulta y seguimiento de trámites de licencias.', 'file-text', 30, 'disponible', true)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  availability = excluded.availability,
  is_active = excluded.is_active,
  updated_at = now();

-- Privilegios explícitos para operaciones exclusivas del backend.
grant select, insert, update, delete on
  public.profiles_tym,
  public.app_sections_tym,
  public.user_section_permissions_tym,
  public.invitations_tym,
  public.invitation_section_permissions_tym,
  public.app_sessions_tym,
  public.audit_logs_tym,
  public.data_imports_tym,
  public.email_delivery_logs_tym
to service_role;

grant usage, select on all sequences in schema public to service_role;

commit;


-- =============================================================================
-- 03. Vistas y RPC de NPS/Refrendos sin límite global de registros
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202607230006_nps_refrendos_todos_registros.sql
-- =============================================================================

-- =============================================================================
-- TYM | Optimización NPS y Refrendos sin perder registros
--
-- Objetivo:
--   1. Los KPIs y gráficas se calculan con TODOS los registros que cumplen
--      los filtros seleccionados.
--   2. Las tablas muestran TODOS los registros filtrados mediante paginación.
--   3. Las funciones de exportación devuelven TODOS los registros filtrados,
--      sin LIMIT ni paginación.
--   4. Las vistas de detalle conservan una fila por registro original.
--
-- Filtros NPS:
--   - Dependencia
--   - Sucursal
--   - Fecha inicial / fecha final
--
-- Filtros Refrendos:
--   - Año
--   - Mes
--   - Fecha inicial / fecha final
--   - Movimiento
--   - Hora
-- =============================================================================

begin;

-- =============================================================================
-- 1. ÍNDICES
-- =============================================================================

create index if not exists idx_nps_tym_dashboard_filters
  on public.nps_responses_tym (
    survey_submitted_at desc,
    dependencia,
    sucursal_branch,
    submit_id desc
  )
  include (
    recomienda_citas,
    estrellas_facilidad_uso,
    estrellas_trato_personal
  );

create index if not exists idx_nps_tym_dependencia_sucursal_fecha
  on public.nps_responses_tym (
    dependencia,
    sucursal_branch,
    survey_submitted_at desc
  );

create index if not exists idx_refrendo_tym_dashboard_filters
  on public.refrendo_diario (
    anio,
    mes,
    fecha desc,
    hora,
    movimiento,
    id desc
  )
  include (
    total_registros,
    es_digital,
    es_tradicional
  );

create index if not exists idx_refrendo_tym_fecha_movimiento
  on public.refrendo_diario (
    fecha desc,
    movimiento,
    hora,
    id desc
  );

-- =============================================================================
-- 2. VISTA DE DETALLE NPS
--    Conserva una fila por cada respuesta original.
-- =============================================================================

create or replace view public.vw_nps_detalle_tym
with (security_invoker = true)
as
select
  r.submit_id,
  r.booking_id,
  r.form_id,
  r.survey_name,
  r.team_id,
  r.dependencia,
  r.team_branch_id,
  r.sucursal_branch,
  r.booking_folio,
  r.booking_status,
  r.start_at,
  r.end_at,
  r.check_in_at,
  r.check_out_at,
  r.entity_id,
  r.entity_type,
  r.survey_submitted_at,
  r.booking_created_at,
  r.comentario_libre,
  r.recomienda_citas,
  coalesce(r.estrellas_facilidad_uso, 0)::smallint as estrellas_facilidad_uso,
  coalesce(r.estrellas_trato_personal, 0)::smallint as estrellas_trato_personal,
  round(
    (
      coalesce(r.estrellas_facilidad_uso, 0)::numeric
      + coalesce(r.estrellas_trato_personal, 0)::numeric
    ) / 2.0,
    1
  ) as score,
  r.created_at,
  r.updated_at
from public.nps_responses_tym r;

-- =============================================================================
-- 3. FUNCIÓN DEL TABLERO NPS
--
-- IMPORTANTE:
--   - metrics, trend y distribution usan TODOS los registros filtrados.
--   - comments/records contienen la página solicitada.
--   - pagination.total indica la cantidad TOTAL de registros del filtro.
--   - Cambiando p_page se pueden recorrer TODOS los registros.
-- =============================================================================

create or replace function public.get_nps_dashboard_tym_v2(
  p_dependencia text default null,
  p_sucursal text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 10), 200);
  v_sort text := case
    when lower(coalesce(p_sort, '')) in ('date', 'dependencia', 'feedback', 'score')
      then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-nps',
       'view'
     ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with filtered as materialized (
    select
      v.submit_id,
      v.booking_id,
      v.form_id,
      v.survey_name,
      v.dependencia,
      v.sucursal_branch,
      v.booking_folio,
      v.booking_status,
      v.survey_submitted_at,
      v.comentario_libre,
      v.recomienda_citas,
      v.estrellas_facilidad_uso,
      v.estrellas_trato_personal,
      v.score
    from public.vw_nps_detalle_tym v
    where (p_dependencia is null or v.dependencia = p_dependencia)
      and (p_sucursal is null or v.sucursal_branch = p_sucursal)
      and (
        p_date_from is null
        or v.survey_submitted_at >= p_date_from::timestamptz
      )
      and (
        p_date_to is null
        or v.survey_submitted_at < (p_date_to + 1)::timestamptz
      )
  ),
  metrics as (
    select
      count(*)::bigint as total,
      coalesce(
        round(
          100.0
          * sum(case when recomienda_citas then 1 else -1 end)
          / nullif(count(*), 0)
        ),
        0
      )::integer as nps,
      coalesce(round(avg(estrellas_facilidad_uso), 1), 0) as facilidad,
      coalesce(round(avg(estrellas_trato_personal), 1), 0) as trato,
      count(*) filter (where recomienda_citas)::bigint as promotores,
      count(*) filter (where not recomienda_citas)::bigint as detractores
    from filtered
  ),
  trend_rows as (
    select
      date_trunc('month', survey_submitted_at) as month_start,
      count(*)::bigint as total,
      coalesce(
        round(
          100.0
          * sum(case when recomienda_citas then 1 else -1 end)
          / nullif(count(*), 0)
        ),
        0
      )::integer as nps,
      round(avg(estrellas_facilidad_uso), 1) as facilidad,
      round(avg(estrellas_trato_personal), 1) as trato
    from filtered
    group by 1
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by
          case
            when v_sort = 'date' and v_direction = 'asc'
              then f.survey_submitted_at
          end asc,
          case
            when v_sort = 'date' and v_direction = 'desc'
              then f.survey_submitted_at
          end desc,
          case
            when v_sort = 'dependencia' and v_direction = 'asc'
              then lower(f.dependencia || ' ' || f.sucursal_branch)
          end asc,
          case
            when v_sort = 'dependencia' and v_direction = 'desc'
              then lower(f.dependencia || ' ' || f.sucursal_branch)
          end desc,
          case
            when v_sort = 'feedback' and v_direction = 'asc'
              then lower(coalesce(f.comentario_libre, ''))
          end asc,
          case
            when v_sort = 'feedback' and v_direction = 'desc'
              then lower(coalesce(f.comentario_libre, ''))
          end desc,
          case
            when v_sort = 'score' and v_direction = 'asc'
              then f.score
          end asc,
          case
            when v_sort = 'score' and v_direction = 'desc'
              then f.score
          end desc,
          f.submit_id desc
      ) as row_number_tym
    from filtered f
  ),
  records_page as (
    select *
    from ordered
    where row_number_tym between
      ((v_page - 1) * v_page_size) + 1
      and v_page * v_page_size
  )
  select jsonb_build_object(
    'metrics', (
      select to_jsonb(m)
      from metrics m
    ),
    'distribution', jsonb_build_object(
      'promotores', (select promotores from metrics),
      'detractores', (select detractores from metrics),
      'total', (select total from metrics)
    ),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(t.month_start, 'YYYY-MM'),
          'monthStart', t.month_start,
          'nps', t.nps,
          'total', t.total,
          'facilidad', t.facilidad,
          'trato', t.trato
        )
        order by t.month_start
      )
      from trend_rows t
    ), '[]'::jsonb),
    'dependencias', coalesce((
      select jsonb_agg(d.value order by d.value)
      from (
        select distinct r.dependencia as value
        from public.nps_responses_tym r
        where r.dependencia is not null
      ) d
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(s.value order by s.value)
      from (
        select distinct r.sucursal_branch as value
        from public.nps_responses_tym r
        where r.sucursal_branch is not null
          and (
            p_dependencia is null
            or r.dependencia = p_dependencia
          )
      ) s
    ), '[]'::jsonb),
    -- Se conservan ambos nombres para compatibilidad con el tablero.
    'comments', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total from metrics),
      'totalPages', case
        when (select total from metrics) = 0 then 0
        else ceil(
          (select total from metrics)::numeric / v_page_size
        )::integer
      end,
      'hasPrevious', v_page > 1,
      'hasNext', v_page < case
        when (select total from metrics) = 0 then 0
        else ceil(
          (select total from metrics)::numeric / v_page_size
        )::integer
      end
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- 4. EXPORTACIÓN NPS
--    Devuelve TODOS los registros que cumplen el filtro, sin LIMIT.
-- =============================================================================

create or replace function public.get_nps_filtered_rows_tym(
  p_dependencia text default null,
  p_sucursal text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns table (
  submit_id bigint,
  booking_id bigint,
  form_id bigint,
  survey_name text,
  dependencia text,
  sucursal_branch text,
  booking_folio text,
  booking_status text,
  survey_submitted_at timestamptz,
  comentario_libre text,
  recomienda_citas boolean,
  estrellas_facilidad_uso smallint,
  estrellas_trato_personal smallint,
  score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sort text := case
    when lower(coalesce(p_sort, '')) in ('date', 'dependencia', 'feedback', 'score')
      then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-nps',
       'export'
     ) then
    raise exception 'No autorizado para exportar' using errcode = '42501';
  end if;

  return query
  select
    v.submit_id,
    v.booking_id,
    v.form_id,
    v.survey_name,
    v.dependencia,
    v.sucursal_branch,
    v.booking_folio,
    v.booking_status,
    v.survey_submitted_at,
    v.comentario_libre,
    v.recomienda_citas,
    v.estrellas_facilidad_uso,
    v.estrellas_trato_personal,
    v.score
  from public.vw_nps_detalle_tym v
  where (p_dependencia is null or v.dependencia = p_dependencia)
    and (p_sucursal is null or v.sucursal_branch = p_sucursal)
    and (
      p_date_from is null
      or v.survey_submitted_at >= p_date_from::timestamptz
    )
    and (
      p_date_to is null
      or v.survey_submitted_at < (p_date_to + 1)::timestamptz
    )
  order by
    case
      when v_sort = 'date' and v_direction = 'asc'
        then v.survey_submitted_at
    end asc,
    case
      when v_sort = 'date' and v_direction = 'desc'
        then v.survey_submitted_at
    end desc,
    case
      when v_sort = 'dependencia' and v_direction = 'asc'
        then lower(v.dependencia || ' ' || v.sucursal_branch)
    end asc,
    case
      when v_sort = 'dependencia' and v_direction = 'desc'
        then lower(v.dependencia || ' ' || v.sucursal_branch)
    end desc,
    case
      when v_sort = 'feedback' and v_direction = 'asc'
        then lower(coalesce(v.comentario_libre, ''))
    end asc,
    case
      when v_sort = 'feedback' and v_direction = 'desc'
        then lower(coalesce(v.comentario_libre, ''))
    end desc,
    case
      when v_sort = 'score' and v_direction = 'asc'
        then v.score
    end asc,
    case
      when v_sort = 'score' and v_direction = 'desc'
        then v.score
    end desc,
    v.submit_id desc;
end;
$$;

-- =============================================================================
-- 5. VISTA DE DETALLE REFRENDOS
--    Conserva una fila por cada registro original de refrendo_diario.
-- =============================================================================

create or replace view public.vw_refrendo_detalle_tym
with (security_invoker = true)
as
select
  r.id,
  r.fecha,
  coalesce(r.anio, extract(year from r.fecha)::integer) as anio,
  coalesce(r.mes, extract(month from r.fecha)::integer) as mes,
  coalesce(r.dia, extract(day from r.fecha)::integer) as dia,
  r.dia_semana,
  r.movimiento,
  coalesce(r.total_registros, 0)::integer as total_registros,
  coalesce(r.es_digital, 0)::integer as es_digital,
  coalesce(r.es_tradicional, 0)::integer as es_tradicional,
  coalesce(
    r."Porcentaje_digital",
    case
      when coalesce(r.total_registros, 0) = 0 then 0
      else round(
        100.0 * coalesce(r.es_digital, 0)
        / nullif(r.total_registros, 0),
        2
      )
    end
  ) as porcentaje_digital,
  coalesce(
    r."Porcentaje_Tradicional",
    case
      when coalesce(r.total_registros, 0) = 0 then 0
      else round(
        100.0 * coalesce(r.es_tradicional, 0)
        / nullif(r.total_registros, 0),
        2
      )
    end
  ) as porcentaje_tradicional,
  r.resultado,
  r.mensaje,
  r.error,
  r.hora,
  r.created_at,
  r.updated_at
from public.refrendo_diario r;

-- =============================================================================
-- 6. VISTA RESUMIDA REFRENDOS PARA GRÁFICAS
--    Esta vista SÍ agrupa; se usa únicamente para KPIs y gráficas.
--    La tabla debe usar vw_refrendo_detalle_tym o la función del punto 7.
-- =============================================================================

create or replace view public.vw_refrendo_dashboard_diario
with (security_invoker = true)
as
select
  min(v.id) as id,
  v.fecha,
  v.anio,
  v.mes,
  v.dia,
  max(v.dia_semana) as dia_semana,
  v.hora,
  sum(v.total_registros)::bigint as total_registros,
  sum(v.es_digital)::bigint as es_digital,
  sum(v.es_tradicional)::bigint as es_tradicional,
  case
    when sum(v.total_registros) = 0 then 0
    else round(
      100.0 * sum(v.es_digital) / sum(v.total_registros),
      2
    )
  end as porcentaje_digital,
  case
    when sum(v.total_registros) = 0 then 0
    else round(
      100.0 * sum(v.es_tradicional) / sum(v.total_registros),
      2
    )
  end as porcentaje_tradicional,
  count(*)::integer as filas_origen,
  max(v.updated_at) as updated_at
from public.vw_refrendo_detalle_tym v
group by
  v.fecha,
  v.anio,
  v.mes,
  v.dia,
  v.hora;

-- =============================================================================
-- 7. FUNCIÓN DEL TABLERO REFRENDOS
--
-- IMPORTANTE:
--   - metrics, dailyTrend y hourlyTrend usan TODOS los registros filtrados.
--   - records contiene la página de detalle, SIN agrupar registros.
--   - pagination.total indica el total real del filtro.
-- =============================================================================

create or replace function public.get_refrendo_dashboard_tym_v2(
  p_anio integer default null,
  p_mes integer default null,
  p_date_from date default null,
  p_date_to date default null,
  p_movimiento text default null,
  p_hora integer default null,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 10), 500);
  v_sort text := case
    when lower(coalesce(p_sort, '')) in (
      'date',
      'movimiento',
      'total',
      'digital',
      'tradicional',
      'hora'
    ) then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-2',
       'view'
     ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with filtered as materialized (
    select v.*
    from public.vw_refrendo_detalle_tym v
    where (p_anio is null or v.anio = p_anio)
      and (p_mes is null or v.mes = p_mes)
      and (p_date_from is null or v.fecha >= p_date_from)
      and (p_date_to is null or v.fecha <= p_date_to)
      and (p_movimiento is null or v.movimiento = p_movimiento)
      and (p_hora is null or v.hora = p_hora)
  ),
  metrics as (
    select
      count(*)::bigint as total_filas,
      coalesce(sum(total_registros), 0)::bigint as total_registros,
      coalesce(sum(es_digital), 0)::bigint as es_digital,
      coalesce(sum(es_tradicional), 0)::bigint as es_tradicional,
      case
        when coalesce(sum(total_registros), 0) = 0 then 0
        else round(
          100.0 * sum(es_digital) / sum(total_registros),
          2
        )
      end as porcentaje_digital,
      case
        when coalesce(sum(total_registros), 0) = 0 then 0
        else round(
          100.0 * sum(es_tradicional) / sum(total_registros),
          2
        )
      end as porcentaje_tradicional,
      min(fecha) as fecha_minima,
      max(fecha) as fecha_maxima
    from filtered
  ),
  daily_rows as (
    select
      fecha,
      sum(total_registros)::bigint as total_registros,
      sum(es_digital)::bigint as es_digital,
      sum(es_tradicional)::bigint as es_tradicional,
      count(*)::bigint as filas
    from filtered
    group by fecha
  ),
  hourly_rows as (
    select
      hora,
      sum(total_registros)::bigint as total_registros,
      sum(es_digital)::bigint as es_digital,
      sum(es_tradicional)::bigint as es_tradicional,
      count(*)::bigint as filas
    from filtered
    group by hora
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by
          case
            when v_sort = 'date' and v_direction = 'asc'
              then f.fecha
          end asc,
          case
            when v_sort = 'date' and v_direction = 'desc'
              then f.fecha
          end desc,
          case
            when v_sort = 'movimiento' and v_direction = 'asc'
              then lower(coalesce(f.movimiento, ''))
          end asc,
          case
            when v_sort = 'movimiento' and v_direction = 'desc'
              then lower(coalesce(f.movimiento, ''))
          end desc,
          case
            when v_sort = 'total' and v_direction = 'asc'
              then f.total_registros
          end asc,
          case
            when v_sort = 'total' and v_direction = 'desc'
              then f.total_registros
          end desc,
          case
            when v_sort = 'digital' and v_direction = 'asc'
              then f.es_digital
          end asc,
          case
            when v_sort = 'digital' and v_direction = 'desc'
              then f.es_digital
          end desc,
          case
            when v_sort = 'tradicional' and v_direction = 'asc'
              then f.es_tradicional
          end asc,
          case
            when v_sort = 'tradicional' and v_direction = 'desc'
              then f.es_tradicional
          end desc,
          case
            when v_sort = 'hora' and v_direction = 'asc'
              then f.hora
          end asc nulls first,
          case
            when v_sort = 'hora' and v_direction = 'desc'
              then f.hora
          end desc nulls last,
          f.fecha desc,
          f.id desc
      ) as row_number_tym
    from filtered f
  ),
  records_page as (
    select *
    from ordered
    where row_number_tym between
      ((v_page - 1) * v_page_size) + 1
      and v_page * v_page_size
  )
  select jsonb_build_object(
    'metrics', (
      select to_jsonb(m)
      from metrics m
    ),
    'dailyTrend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fecha', d.fecha,
          'totalRegistros', d.total_registros,
          'digital', d.es_digital,
          'tradicional', d.es_tradicional,
          'filas', d.filas
        )
        order by d.fecha
      )
      from daily_rows d
    ), '[]'::jsonb),
    'hourlyTrend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'hora', h.hora,
          'totalRegistros', h.total_registros,
          'digital', h.es_digital,
          'tradicional', h.es_tradicional,
          'filas', h.filas
        )
        order by h.hora nulls first
      )
      from hourly_rows h
    ), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(m.value order by m.value)
      from (
        select distinct v.movimiento as value
        from public.vw_refrendo_detalle_tym v
        where v.movimiento is not null
          and (p_anio is null or v.anio = p_anio)
          and (p_mes is null or v.mes = p_mes)
          and (p_date_from is null or v.fecha >= p_date_from)
          and (p_date_to is null or v.fecha <= p_date_to)
      ) m
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total_filas from metrics),
      'totalPages', case
        when (select total_filas from metrics) = 0 then 0
        else ceil(
          (select total_filas from metrics)::numeric / v_page_size
        )::integer
      end,
      'hasPrevious', v_page > 1,
      'hasNext', v_page < case
        when (select total_filas from metrics) = 0 then 0
        else ceil(
          (select total_filas from metrics)::numeric / v_page_size
        )::integer
      end
    )
  )
  into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- 8. EXPORTACIÓN REFRENDOS
--    Devuelve TODOS los registros del filtro, sin agrupar y sin LIMIT.
-- =============================================================================

create or replace function public.get_refrendo_filtered_rows_tym(
  p_anio integer default null,
  p_mes integer default null,
  p_date_from date default null,
  p_date_to date default null,
  p_movimiento text default null,
  p_hora integer default null,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns table (
  id bigint,
  fecha date,
  anio integer,
  mes integer,
  dia integer,
  dia_semana text,
  movimiento text,
  total_registros integer,
  es_digital integer,
  es_tradicional integer,
  porcentaje_digital numeric,
  porcentaje_tradicional numeric,
  resultado boolean,
  mensaje text,
  error integer,
  hora integer,
  created_at timestamp without time zone,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sort text := case
    when lower(coalesce(p_sort, '')) in (
      'date',
      'movimiento',
      'total',
      'digital',
      'tradicional',
      'hora'
    ) then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-2',
       'export'
     ) then
    raise exception 'No autorizado para exportar' using errcode = '42501';
  end if;

  return query
  select
    v.id,
    v.fecha,
    v.anio,
    v.mes,
    v.dia,
    v.dia_semana,
    v.movimiento,
    v.total_registros,
    v.es_digital,
    v.es_tradicional,
    v.porcentaje_digital,
    v.porcentaje_tradicional,
    v.resultado,
    v.mensaje,
    v.error,
    v.hora,
    v.created_at,
    v.updated_at
  from public.vw_refrendo_detalle_tym v
  where (p_anio is null or v.anio = p_anio)
    and (p_mes is null or v.mes = p_mes)
    and (p_date_from is null or v.fecha >= p_date_from)
    and (p_date_to is null or v.fecha <= p_date_to)
    and (p_movimiento is null or v.movimiento = p_movimiento)
    and (p_hora is null or v.hora = p_hora)
  order by
    case
      when v_sort = 'date' and v_direction = 'asc'
        then v.fecha
    end asc,
    case
      when v_sort = 'date' and v_direction = 'desc'
        then v.fecha
    end desc,
    case
      when v_sort = 'movimiento' and v_direction = 'asc'
        then lower(coalesce(v.movimiento, ''))
    end asc,
    case
      when v_sort = 'movimiento' and v_direction = 'desc'
        then lower(coalesce(v.movimiento, ''))
    end desc,
    case
      when v_sort = 'total' and v_direction = 'asc'
        then v.total_registros
    end asc,
    case
      when v_sort = 'total' and v_direction = 'desc'
        then v.total_registros
    end desc,
    case
      when v_sort = 'digital' and v_direction = 'asc'
        then v.es_digital
    end asc,
    case
      when v_sort = 'digital' and v_direction = 'desc'
        then v.es_digital
    end desc,
    case
      when v_sort = 'tradicional' and v_direction = 'asc'
        then v.es_tradicional
    end asc,
    case
      when v_sort = 'tradicional' and v_direction = 'desc'
        then v.es_tradicional
    end desc,
    case
      when v_sort = 'hora' and v_direction = 'asc'
        then v.hora
    end asc nulls first,
    case
      when v_sort = 'hora' and v_direction = 'desc'
        then v.hora
    end desc nulls last,
    v.fecha desc,
    v.id desc;
end;
$$;

-- =============================================================================
-- 9. PERMISOS
-- =============================================================================

revoke all on function public.get_nps_dashboard_tym_v2(
  text,
  text,
  date,
  date,
  integer,
  integer,
  text,
  text
) from public, anon;

grant execute on function public.get_nps_dashboard_tym_v2(
  text,
  text,
  date,
  date,
  integer,
  integer,
  text,
  text
) to authenticated, service_role;

revoke all on function public.get_nps_filtered_rows_tym(
  text,
  text,
  date,
  date,
  text,
  text
) from public, anon;

grant execute on function public.get_nps_filtered_rows_tym(
  text,
  text,
  date,
  date,
  text,
  text
) to authenticated, service_role;

revoke all on function public.get_refrendo_dashboard_tym_v2(
  integer,
  integer,
  date,
  date,
  text,
  integer,
  integer,
  integer,
  text,
  text
) from public, anon;

grant execute on function public.get_refrendo_dashboard_tym_v2(
  integer,
  integer,
  date,
  date,
  text,
  integer,
  integer,
  integer,
  text,
  text
) to authenticated, service_role;

revoke all on function public.get_refrendo_filtered_rows_tym(
  integer,
  integer,
  date,
  date,
  text,
  integer,
  text,
  text
) from public, anon;

grant execute on function public.get_refrendo_filtered_rows_tym(
  integer,
  integer,
  date,
  date,
  text,
  integer,
  text,
  text
) to authenticated, service_role;

-- La vista NPS respeta las políticas RLS de nps_responses_tym.
grant select on public.vw_nps_detalle_tym to authenticated, service_role;

-- Las vistas de Refrendos se dejan para uso del backend con service_role.
revoke all on public.vw_refrendo_detalle_tym from public, anon, authenticated;
revoke all on public.vw_refrendo_dashboard_diario from public, anon, authenticated;
grant select on public.vw_refrendo_detalle_tym to service_role;
grant select on public.vw_refrendo_dashboard_diario to service_role;

commit;

-- =============================================================================
-- EJEMPLOS DE PRUEBA
-- =============================================================================

-- NPS: todos los resultados de julio, en páginas de 50 registros.
-- select public.get_nps_dashboard_tym_v2(
--   null,
--   null,
--   '2026-07-01',
--   '2026-07-31',
--   1,
--   50,
--   'date',
--   'desc'
-- );

-- NPS: exportación completa del mismo filtro, sin límite.
-- select *
-- from public.get_nps_filtered_rows_tym(
--   null,
--   null,
--   '2026-07-01',
--   '2026-07-31',
--   'date',
--   'desc'
-- );

-- Refrendos: todos los registros de julio de 2026, página 1 de 100.
-- select public.get_refrendo_dashboard_tym_v2(
--   2026,
--   7,
--   null,
--   null,
--   null,
--   null,
--   1,
--   100,
--   'date',
--   'desc'
-- );

-- Refrendos: exportación completa de julio de 2026, sin límite.
-- select *
-- from public.get_refrendo_filtered_rows_tym(
--   2026,
--   7,
--   null,
--   null,
--   null,
--   null,
--   'date',
--   'desc'
-- );


-- =============================================================================
-- 04. Filtros cruzados y RPC NPS actuales
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202607230007_nps_cross_filters.sql
-- =============================================================================

-- =============================================================================
-- TYM | Filtros cruzados NPS y catálogo completo de sucursales
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No elimina tablas ni registros.
-- =============================================================================

begin;

create or replace function public.get_nps_dashboard_tym_v3(
  p_dependencia text default null,
  p_sucursal text default null,
  p_recomienda boolean default null,
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 10), 200);
  v_sort text := case
    when lower(coalesce(p_sort, '')) in ('date', 'dependencia', 'feedback', 'score')
      then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-nps',
       'view'
     ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with filtered as materialized (
    select
      v.submit_id,
      v.booking_id,
      v.form_id,
      v.survey_name,
      v.dependencia,
      v.sucursal_branch,
      v.booking_folio,
      v.booking_status,
      v.survey_submitted_at,
      v.comentario_libre,
      v.recomienda_citas,
      v.estrellas_facilidad_uso,
      v.estrellas_trato_personal,
      v.score
    from public.vw_nps_detalle_tym v
    where (p_dependencia is null or v.dependencia = p_dependencia)
      and (p_sucursal is null or v.sucursal_branch = p_sucursal)
      and (p_recomienda is null or v.recomienda_citas = p_recomienda)
      and (
        p_date_from is null
        or v.survey_submitted_at >= p_date_from::timestamptz
      )
      and (
        p_date_to is null
        or v.survey_submitted_at < (p_date_to + 1)::timestamptz
      )
  ),
  metrics as (
    select
      count(*)::bigint as total,
      coalesce(
        round(
          100.0
          * sum(case when recomienda_citas then 1 else -1 end)
          / nullif(count(*), 0)
        ),
        0
      )::integer as nps,
      coalesce(round(avg(estrellas_facilidad_uso), 1), 0) as facilidad,
      coalesce(round(avg(estrellas_trato_personal), 1), 0) as trato,
      count(*) filter (where recomienda_citas)::bigint as promotores,
      count(*) filter (where not recomienda_citas)::bigint as detractores
    from filtered
  ),
  trend_rows as (
    select
      date_trunc('month', survey_submitted_at) as month_start,
      count(*)::bigint as total,
      coalesce(
        round(
          100.0
          * sum(case when recomienda_citas then 1 else -1 end)
          / nullif(count(*), 0)
        ),
        0
      )::integer as nps,
      round(avg(estrellas_facilidad_uso), 1) as facilidad,
      round(avg(estrellas_trato_personal), 1) as trato
    from filtered
    group by 1
  ),
  ordered as (
    select
      f.*,
      row_number() over (
        order by
          case
            when v_sort = 'date' and v_direction = 'asc'
              then f.survey_submitted_at
          end asc,
          case
            when v_sort = 'date' and v_direction = 'desc'
              then f.survey_submitted_at
          end desc,
          case
            when v_sort = 'dependencia' and v_direction = 'asc'
              then lower(f.dependencia || ' ' || f.sucursal_branch)
          end asc,
          case
            when v_sort = 'dependencia' and v_direction = 'desc'
              then lower(f.dependencia || ' ' || f.sucursal_branch)
          end desc,
          case
            when v_sort = 'feedback' and v_direction = 'asc'
              then lower(coalesce(f.comentario_libre, ''))
          end asc,
          case
            when v_sort = 'feedback' and v_direction = 'desc'
              then lower(coalesce(f.comentario_libre, ''))
          end desc,
          case
            when v_sort = 'score' and v_direction = 'asc'
              then f.score
          end asc,
          case
            when v_sort = 'score' and v_direction = 'desc'
              then f.score
          end desc,
          f.submit_id desc
      ) as row_number_tym
    from filtered f
  ),
  records_page as (
    select *
    from ordered
    where row_number_tym between
      ((v_page - 1) * v_page_size) + 1
      and v_page * v_page_size
  )
  select jsonb_build_object(
    'metrics', (
      select to_jsonb(m)
      from metrics m
    ),
    'distribution', jsonb_build_object(
      'promotores', (select promotores from metrics),
      'detractores', (select detractores from metrics),
      'total', (select total from metrics)
    ),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(t.month_start, 'YYYY-MM'),
          'monthStart', t.month_start,
          'nps', t.nps,
          'total', t.total,
          'facilidad', t.facilidad,
          'trato', t.trato
        )
        order by t.month_start
      )
      from trend_rows t
    ), '[]'::jsonb),
    'dependencias', coalesce((
      select jsonb_agg(d.value order by d.value)
      from (
        select distinct r.dependencia as value
        from public.nps_responses_tym r
        where r.dependencia is not null
      ) d
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(s.value order by s.value)
      from (
        select distinct r.sucursal_branch as value
        from public.nps_responses_tym r
        where r.sucursal_branch is not null
          and (
            p_dependencia is null
            or r.dependencia = p_dependencia
          )
      ) s
    ), '[]'::jsonb),
    -- Se conservan ambos nombres para compatibilidad con el tablero.
    'comments', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total from metrics),
      'totalPages', case
        when (select total from metrics) = 0 then 0
        else ceil(
          (select total from metrics)::numeric / v_page_size
        )::integer
      end,
      'hasPrevious', v_page > 1,
      'hasNext', v_page < case
        when (select total from metrics) = 0 then 0
        else ceil(
          (select total from metrics)::numeric / v_page_size
        )::integer
      end
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_nps_filtered_rows_tym_v2(
  p_dependencia text default null,
  p_sucursal text default null,
  p_recomienda boolean default null,
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns table (
  submit_id bigint,
  booking_id bigint,
  form_id bigint,
  survey_name text,
  dependencia text,
  sucursal_branch text,
  booking_folio text,
  booking_status text,
  survey_submitted_at timestamptz,
  comentario_libre text,
  recomienda_citas boolean,
  estrellas_facilidad_uso smallint,
  estrellas_trato_personal smallint,
  score numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sort text := case
    when lower(coalesce(p_sort, '')) in ('date', 'dependencia', 'feedback', 'score')
      then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-nps',
       'export'
     ) then
    raise exception 'No autorizado para exportar' using errcode = '42501';
  end if;

  return query
  select
    v.submit_id,
    v.booking_id,
    v.form_id,
    v.survey_name,
    v.dependencia,
    v.sucursal_branch,
    v.booking_folio,
    v.booking_status,
    v.survey_submitted_at,
    v.comentario_libre,
    v.recomienda_citas,
    v.estrellas_facilidad_uso,
    v.estrellas_trato_personal,
    v.score
  from public.vw_nps_detalle_tym v
  where (p_dependencia is null or v.dependencia = p_dependencia)
    and (p_sucursal is null or v.sucursal_branch = p_sucursal)
    and (p_recomienda is null or v.recomienda_citas = p_recomienda)
    and (
      p_date_from is null
      or v.survey_submitted_at >= p_date_from::timestamptz
    )
    and (
      p_date_to is null
      or v.survey_submitted_at < (p_date_to + 1)::timestamptz
    )
  order by
    case
      when v_sort = 'date' and v_direction = 'asc'
        then v.survey_submitted_at
    end asc,
    case
      when v_sort = 'date' and v_direction = 'desc'
        then v.survey_submitted_at
    end desc,
    case
      when v_sort = 'dependencia' and v_direction = 'asc'
        then lower(v.dependencia || ' ' || v.sucursal_branch)
    end asc,
    case
      when v_sort = 'dependencia' and v_direction = 'desc'
        then lower(v.dependencia || ' ' || v.sucursal_branch)
    end desc,
    case
      when v_sort = 'feedback' and v_direction = 'asc'
        then lower(coalesce(v.comentario_libre, ''))
    end asc,
    case
      when v_sort = 'feedback' and v_direction = 'desc'
        then lower(coalesce(v.comentario_libre, ''))
    end desc,
    case
      when v_sort = 'score' and v_direction = 'asc'
        then v.score
    end asc,
    case
      when v_sort = 'score' and v_direction = 'desc'
        then v.score
    end desc,
    v.submit_id desc;
end;
$$;

revoke all on function public.get_nps_dashboard_tym_v3(
  text, text, boolean, date, date, integer, integer, text, text
) from public, anon;

grant execute on function public.get_nps_dashboard_tym_v3(
  text, text, boolean, date, date, integer, integer, text, text
) to authenticated, service_role;

revoke all on function public.get_nps_filtered_rows_tym_v2(
  text, text, boolean, date, date, text, text
) from public, anon;

grant execute on function public.get_nps_filtered_rows_tym_v2(
  text, text, boolean, date, date, text, text
) to authenticated, service_role;

commit;


-- =============================================================================
-- 05. Restablecimiento seguro de contraseñas
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202607270001_password_resets_tym.sql
-- =============================================================================

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


-- =============================================================================
-- 06. Límites de intentos distribuidos
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202607270002_rate_limits_tym.sql
-- =============================================================================

-- V4.9: limitación distribuida de intentos para rutas sensibles.
-- Los identificadores se guardan exclusivamente como HMAC-SHA256.

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


-- =============================================================================
-- 07. Vista y RPC de Licencias 2025–2026
-- Fuente consolidada: work/user_zip6_20260807/sistema-movilidad-tym/supabase/migrations/202608070002_expand_licencias_2025_2026.sql
-- =============================================================================

-- =============================================================================
-- LICENCIAS 2025-2026: VISTA DIARIA Y FUNCIÓN OPTIMIZADA DEL TABLERO
--
-- Ejecutar una sola vez en Supabase SQL Editor antes de publicar el código.
-- No elimina ni modifica registros existentes.
-- =============================================================================

begin;

do $$
declare
  v_relkind "char";
begin
  select c.relkind
    into v_relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'licencias_tramites_tym';

  if v_relkind is null then
    raise exception 'No existe public.licencias_tramites_tym';
  end if;

  if v_relkind in ('r', 'p') then
    execute 'create index if not exists licencias_tramites_tym_fecha_idx
      on public.licencias_tramites_tym (fecha)';
    execute 'create index if not exists licencias_tramites_tym_fecha_tipos_idx
      on public.licencias_tramites_tym (fecha, tipo_tramite_id, tipo_licencia_id)';
  end if;
end;
$$;

create or replace view public.vw_licencias_dashboard_diario_tym
with (security_invoker = true)
as
select
  min(l.id)::bigint as id,
  l.fecha::date as fecha,
  extract(year from l.fecha::date)::integer as anio,
  ('MES ' || extract(month from l.fecha::date)::integer)::text as mes,
  max(l.dia_semana::text) as dia_semana,
  l.tipo_tramite_id::integer as tipo_tramite_id,
  max(nullif(btrim(l.tipo_tramite::text), '')) as tipo_tramite,
  l.tipo_licencia_id::integer as tipo_licencia_id,
  max(nullif(btrim(l.tipo_licencia::text), '')) as tipo_licencia,
  sum(coalesce(l.tramites_presenciales::bigint, 0))::bigint as tramites_presenciales,
  sum(coalesce(l.tramites_en_linea::bigint, 0))::bigint as tramites_en_linea,
  sum(
    coalesce(l.tramites_presenciales::bigint, 0)
    + coalesce(l.tramites_en_linea::bigint, 0)
  )::bigint as total_tramites,
  max(l.actualizado_en) as actualizado_en
from public.licencias_tramites_tym l
where l.fecha::date >= date '2025-01-01'
  and l.fecha::date < date '2027-01-01'
group by
  l.fecha::date,
  l.tipo_tramite_id::integer,
  l.tipo_licencia_id::integer;

create or replace function public.get_licencias_dashboard_tym_v1(
  p_date_from date default date '2025-01-01',
  p_date_to date default current_date,
  p_tipo_tramite_id integer default null,
  p_tipo_licencia_id integer default null,
  p_modalidad text default null,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'date',
  p_direction text default 'desc'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_date_from date := greatest(coalesce(p_date_from, date '2025-01-01'), date '2025-01-01');
  v_date_to date := least(coalesce(p_date_to, current_date), date '2026-12-31');
  v_modalidad text := case
    when lower(coalesce(p_modalidad, '')) in ('en_linea', 'presencial')
      then lower(p_modalidad)
    else null
  end;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 10), 500);
  v_sort text := case
    when lower(coalesce(p_sort, '')) in (
      'date',
      'tipo_tramite',
      'tipo_licencia',
      'presencial',
      'en_linea',
      'total'
    ) then lower(p_sort)
    else 'date'
  end;
  v_direction text := case
    when lower(coalesce(p_direction, '')) = 'asc' then 'asc'
    else 'desc'
  end;
begin
  if v_date_to < v_date_from then
    raise exception 'La fecha final no puede ser anterior a la fecha inicial';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not public.has_section_permission_tym(
       auth.uid(),
       'dashboard-licencias',
       'view'
     ) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with summary_filtered as materialized (
    select
      s.id,
      s.fecha,
      s.anio,
      s.mes,
      s.dia_semana,
      s.tipo_tramite_id,
      s.tipo_tramite,
      s.tipo_licencia_id,
      s.tipo_licencia,
      case
        when v_modalidad = 'en_linea' then 0::bigint
        else s.tramites_presenciales
      end as tramites_presenciales,
      case
        when v_modalidad = 'presencial' then 0::bigint
        else s.tramites_en_linea
      end as tramites_en_linea,
      case
        when v_modalidad = 'en_linea' then s.tramites_en_linea
        when v_modalidad = 'presencial' then s.tramites_presenciales
        else s.total_tramites
      end as total_tramites,
      s.actualizado_en
    from public.vw_licencias_dashboard_diario_tym s
    where s.fecha >= v_date_from
      and s.fecha <= v_date_to
      and (p_tipo_tramite_id is null or s.tipo_tramite_id = p_tipo_tramite_id)
      and (p_tipo_licencia_id is null or s.tipo_licencia_id = p_tipo_licencia_id)
      and (
        v_modalidad is null
        or (v_modalidad = 'en_linea' and s.tramites_en_linea > 0)
        or (v_modalidad = 'presencial' and s.tramites_presenciales > 0)
      )
  ),
  summary_metrics as (
    select
      coalesce(sum(tramites_presenciales), 0)::bigint as tramites_presenciales,
      coalesce(sum(tramites_en_linea), 0)::bigint as tramites_en_linea,
      coalesce(sum(total_tramites), 0)::bigint as total_tramites,
      max(actualizado_en) as actualizado_en
    from summary_filtered
  ),
  records_filtered as materialized (
    select
      l.id,
      l.fecha::date as fecha,
      coalesce(l.anio::integer, extract(year from l.fecha::date)::integer) as anio,
      coalesce(l.mes::text, ('MES ' || extract(month from l.fecha::date)::integer)::text) as mes,
      l.dia_semana::text as dia_semana,
      l.tipo_tramite_id::integer as tipo_tramite_id,
      l.tipo_tramite::text as tipo_tramite,
      l.tipo_licencia_id::integer as tipo_licencia_id,
      l.tipo_licencia::text as tipo_licencia,
      coalesce(l.tramites_presenciales::bigint, 0) as tramites_presenciales,
      coalesce(l.tramites_en_linea::bigint, 0) as tramites_en_linea,
      case
        when v_modalidad = 'en_linea' then coalesce(l.tramites_en_linea::bigint, 0)
        when v_modalidad = 'presencial' then coalesce(l.tramites_presenciales::bigint, 0)
        else coalesce(l.tramites_presenciales::bigint, 0)
          + coalesce(l.tramites_en_linea::bigint, 0)
      end as total_tramites,
      l.actualizado_en
    from public.licencias_tramites_tym l
    where l.fecha::date >= v_date_from
      and l.fecha::date <= v_date_to
      and (p_tipo_tramite_id is null or l.tipo_tramite_id::integer = p_tipo_tramite_id)
      and (p_tipo_licencia_id is null or l.tipo_licencia_id::integer = p_tipo_licencia_id)
      and (
        v_modalidad is null
        or (v_modalidad = 'en_linea' and coalesce(l.tramites_en_linea::bigint, 0) > 0)
        or (v_modalidad = 'presencial' and coalesce(l.tramites_presenciales::bigint, 0) > 0)
      )
  ),
  record_metrics as (
    select count(*)::bigint as total_filas
    from records_filtered
  ),
  ordered as (
    select
      r.*,
      row_number() over (
        order by
          case when v_sort = 'date' and v_direction = 'asc' then r.fecha end asc,
          case when v_sort = 'date' and v_direction = 'desc' then r.fecha end desc,
          case when v_sort = 'tipo_tramite' and v_direction = 'asc' then lower(coalesce(r.tipo_tramite, '')) end asc,
          case when v_sort = 'tipo_tramite' and v_direction = 'desc' then lower(coalesce(r.tipo_tramite, '')) end desc,
          case when v_sort = 'tipo_licencia' and v_direction = 'asc' then lower(coalesce(r.tipo_licencia, '')) end asc,
          case when v_sort = 'tipo_licencia' and v_direction = 'desc' then lower(coalesce(r.tipo_licencia, '')) end desc,
          case when v_sort = 'presencial' and v_direction = 'asc' then r.tramites_presenciales end asc,
          case when v_sort = 'presencial' and v_direction = 'desc' then r.tramites_presenciales end desc,
          case when v_sort = 'en_linea' and v_direction = 'asc' then r.tramites_en_linea end asc,
          case when v_sort = 'en_linea' and v_direction = 'desc' then r.tramites_en_linea end desc,
          case when v_sort = 'total' and v_direction = 'asc' then r.total_tramites end asc,
          case when v_sort = 'total' and v_direction = 'desc' then r.total_tramites end desc,
          r.fecha desc,
          r.id desc
      ) as row_number_tym
    from records_filtered r
  ),
  records_page as (
    select *
    from ordered
    where row_number_tym between
      ((v_page - 1) * v_page_size) + 1
      and v_page * v_page_size
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'tramites_presenciales', (select tramites_presenciales from summary_metrics),
      'tramites_en_linea', (select tramites_en_linea from summary_metrics),
      'total_tramites', (select total_tramites from summary_metrics)
    ),
    'dailyTrend', coalesce((
      select jsonb_agg(
        to_jsonb(d)
        order by d.fecha, d.tipo_tramite, d.tipo_licencia, d.id
      )
      from summary_filtered d
    ), '[]'::jsonb),
    'records', coalesce((
      select jsonb_agg(
        to_jsonb(rp) - 'row_number_tym'
        order by rp.row_number_tym
      )
      from records_page rp
    ), '[]'::jsonb),
    'filters', jsonb_build_object(
      'tiposTramite', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', f.id, 'nombre', f.nombre)
          order by f.nombre
        )
        from (
          select
            v.tipo_tramite_id as id,
            max(v.tipo_tramite) as nombre
          from public.vw_licencias_dashboard_diario_tym v
          where v.fecha >= v_date_from
            and v.fecha <= v_date_to
            and v.tipo_tramite_id is not null
            and v.tipo_tramite is not null
          group by v.tipo_tramite_id
        ) f
      ), '[]'::jsonb),
      'tiposLicencia', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', f.id, 'nombre', f.nombre)
          order by f.nombre
        )
        from (
          select
            v.tipo_licencia_id as id,
            max(v.tipo_licencia) as nombre
          from public.vw_licencias_dashboard_diario_tym v
          where v.fecha >= v_date_from
            and v.fecha <= v_date_to
            and v.tipo_licencia_id is not null
            and v.tipo_licencia is not null
          group by v.tipo_licencia_id
        ) f
      ), '[]'::jsonb)
    ),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total_filas from record_metrics),
      'totalPages', case
        when (select total_filas from record_metrics) = 0 then 0
        else ceil((select total_filas from record_metrics)::numeric / v_page_size)::integer
      end,
      'hasPrevious', v_page > 1,
      'hasNext', v_page < case
        when (select total_filas from record_metrics) = 0 then 0
        else ceil((select total_filas from record_metrics)::numeric / v_page_size)::integer
      end
    ),
    'actualizado_en', (select actualizado_en from summary_metrics)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_licencias_dashboard_tym_v1(
  date,
  date,
  integer,
  integer,
  text,
  integer,
  integer,
  text,
  text
) from public, anon;

grant execute on function public.get_licencias_dashboard_tym_v1(
  date,
  date,
  integer,
  integer,
  text,
  integer,
  integer,
  text,
  text
) to authenticated, service_role;

revoke all on public.vw_licencias_dashboard_diario_tym
  from public, anon, authenticated;
grant select on public.vw_licencias_dashboard_diario_tym to service_role;

commit;

-- Verificación: debe mostrar la vista y la función.
select
  to_regclass('public.vw_licencias_dashboard_diario_tym') as vista_licencias,
  to_regprocedure(
    'public.get_licencias_dashboard_tym_v1(date,date,integer,integer,text,integer,integer,text,text)'
  ) as funcion_licencias;


-- =============================================================================
-- 08. Seguridad y rendimiento final
-- Fuente consolidada: work/audit_zip7_20260810/sistema-movilidad-tym/supabase/migrations/202608100001_final_security_performance.sql
-- =============================================================================

-- =============================================================================
-- TYM | Seguridad y rendimiento final
-- Fecha: 2026-08-10
-- Idempotente. No elimina tablas ni registros de negocio.
-- =============================================================================

begin;

-- Reduce las consultas de autenticación de varias llamadas REST a un solo RPC.
-- Sólo el backend con service_role puede ejecutarlo.
create or replace function public.get_app_session_context_tym(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile jsonb;
  v_session jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_role text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'role', p.role,
    'status', p.status
  ), p.role::text
  into v_profile, v_role
  from public.profiles_tym p
  where p.id = p_user_id
  limit 1;

  select jsonb_build_object(
    'session_id', s.session_id,
    'last_activity_at', s.last_activity_at,
    'absolute_expires_at', s.absolute_expires_at,
    'revoked_at', s.revoked_at
  )
  into v_session
  from public.app_sessions_tym s
  where s.session_id = p_session_id
    and s.user_id = p_user_id
  limit 1;

  if v_profile is not null then
    if v_role = 'administrador' then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'slug', s.slug,
          'title', s.title,
          'description', s.description,
          'icon', s.icon,
          'sort_order', s.sort_order,
          'availability', case
            when s.slug = 'dashboard-2' then 'disponible'
            else s.availability::text
          end,
          'can_view', true,
          'can_edit', true,
          'can_export', true
        ) order by s.sort_order
      ), '[]'::jsonb)
      into v_sections
      from public.app_sections_tym s
      where s.is_active = true;
    else
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'slug', s.slug,
          'title', s.title,
          'description', s.description,
          'icon', s.icon,
          'sort_order', s.sort_order,
          'availability', case
            when s.slug = 'dashboard-2' then 'disponible'
            else s.availability::text
          end,
          'can_view', usp.can_view,
          'can_edit', usp.can_edit,
          'can_export', usp.can_export
        ) order by s.sort_order
      ), '[]'::jsonb)
      into v_sections
      from public.app_sections_tym s
      join public.user_section_permissions_tym usp
        on usp.section_id = s.id
       and usp.user_id = p_user_id
       and usp.can_view = true
      where s.is_active = true;
    end if;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'session', v_session,
    'sections', v_sections
  );
end;
$$;

revoke all on function public.get_app_session_context_tym(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_app_session_context_tym(uuid, uuid)
  to service_role;

-- RLS para tablas incorporadas después del esquema inicial.
alter table public.licencias_tramites_tym enable row level security;
drop policy if exists licencias_tramites_tym_read_authorized
  on public.licencias_tramites_tym;
create policy licencias_tramites_tym_read_authorized
  on public.licencias_tramites_tym
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-licencias', 'view'));
revoke all on public.licencias_tramites_tym from public, anon;
grant select on public.licencias_tramites_tym to authenticated, service_role;

alter table public.refrendo_diario enable row level security;
drop policy if exists refrendo_diario_read_authorized
  on public.refrendo_diario;
create policy refrendo_diario_read_authorized
  on public.refrendo_diario
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-2', 'view'));
revoke all on public.refrendo_diario from public, anon;
grant select on public.refrendo_diario to authenticated, service_role;

alter table public.recaudacion_licencias_tym enable row level security;
drop policy if exists recaudacion_licencias_tym_read_authorized
  on public.recaudacion_licencias_tym;
create policy recaudacion_licencias_tym_read_authorized
  on public.recaudacion_licencias_tym
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-licencias', 'view'));
revoke all on public.recaudacion_licencias_tym from public, anon;
grant select on public.recaudacion_licencias_tym to authenticated, service_role;

alter table public.recaudacion_refrendo_tym enable row level security;
drop policy if exists recaudacion_refrendo_tym_read_authorized
  on public.recaudacion_refrendo_tym;
create policy recaudacion_refrendo_tym_read_authorized
  on public.recaudacion_refrendo_tym
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-2', 'view'));
revoke all on public.recaudacion_refrendo_tym from public, anon;
grant select on public.recaudacion_refrendo_tym to authenticated, service_role;

-- Los registros de entrega de correo son exclusivamente administrativos.
alter table public.email_delivery_logs_tym enable row level security;
revoke all on public.email_delivery_logs_tym from public, anon, authenticated;
grant select, insert, update, delete on public.email_delivery_logs_tym to service_role;

-- Ya existe el trigger canónico refrendo_diario_set_updated_at. Se elimina el
-- segundo trigger redundante para evitar ejecutar dos funciones en cada UPDATE.
drop trigger if exists trigger_refrendo_diario_updated_at
  on public.refrendo_diario;

-- Índices de acceso que complementan los ya existentes.
create index if not exists app_sessions_tym_active_lookup_idx
  on public.app_sessions_tym(session_id, user_id, revoked_at)
  include (last_activity_at, absolute_expires_at);

create index if not exists recaudacion_licencias_tym_dashboard_idx
  on public.recaudacion_licencias_tym(anio, mes)
  include (monto_proyectado, monto_recaudado, fecha_corte);

create index if not exists recaudacion_refrendo_tym_dashboard_idx
  on public.recaudacion_refrendo_tym(anio, mes)
  include (monto_proyectado, monto_fecha_pago, monto_recaudado, fecha_corte);

commit;

-- Verificación de sólo lectura:
select
  to_regprocedure('public.get_app_session_context_tym(uuid,uuid)') as session_rpc,
  relname as tabla,
  relrowsecurity as rls_activo
from pg_class
where oid in (
  'public.licencias_tramites_tym'::regclass,
  'public.refrendo_diario'::regclass,
  'public.recaudacion_licencias_tym'::regclass,
  'public.recaudacion_refrendo_tym'::regclass,
  'public.email_delivery_logs_tym'::regclass
)
order by relname;


-- =============================================================================
-- 09. Protección y verificación consolidada
-- Fuente consolidada: work/consolidated_sql_20260812/99_final_hardening.sql
-- =============================================================================

-- =============================================================================
-- AJUSTES FINALES DEL ESQUEMA CONSOLIDADO
-- =============================================================================

begin;

-- Tabla preparada para recaudación diaria. La versión actual aún no la consulta,
-- pero queda protegida para la integración posterior de la gráfica.
alter table public.recaudacion_refrendo_diaria_tym enable row level security;
drop policy if exists recaudacion_refrendo_diaria_read_authorized
  on public.recaudacion_refrendo_diaria_tym;
create policy recaudacion_refrendo_diaria_read_authorized
  on public.recaudacion_refrendo_diaria_tym
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-2', 'view'));
revoke all on public.recaudacion_refrendo_diaria_tym from public, anon;
grant select on public.recaudacion_refrendo_diaria_tym to authenticated, service_role;

-- Tablas internas: sólo el backend con service_role puede modificarlas.
revoke all on public.password_reset_tokens_tym from public, anon, authenticated;
revoke all on public.app_rate_limits_tym from public, anon, authenticated;
grant select, insert, update, delete on
  public.password_reset_tokens_tym,
  public.app_rate_limits_tym
to service_role;

-- Los flujos de n8n usan service_role para realizar sus cargas.
grant select, insert, update, delete on
  public.nps_responses_tym,
  public.licencias_tramites_tym,
  public.refrendo_diario,
  public.recaudacion_licencias_tym,
  public.recaudacion_refrendo_tym,
  public.recaudacion_refrendo_diaria_tym
to service_role;

grant usage, select on all sequences in schema public to service_role;

commit;

-- Inventario final: cada columna debe devolver un objeto existente.
select
  to_regclass('public.profiles_tym') as profiles,
  to_regclass('public.app_sections_tym') as sections,
  to_regclass('public.nps_responses_tym') as nps,
  to_regclass('public.refrendo_diario') as refrendos,
  to_regclass('public.licencias_tramites_tym') as licencias,
  to_regclass('public.recaudacion_refrendo_tym') as recaudacion_refrendo,
  to_regclass('public.recaudacion_licencias_tym') as recaudacion_licencias,
  to_regclass('public.email_delivery_logs_tym') as email_logs;

select
  to_regprocedure('public.get_app_session_context_tym(uuid,uuid)') as session_context,
  to_regprocedure('public.get_nps_dashboard_tym_v3(text,text,boolean,date,date,integer,integer,text,text)') as nps_dashboard,
  to_regprocedure('public.get_nps_filtered_rows_tym_v2(text,text,boolean,date,date,text,text)') as nps_export,
  to_regprocedure('public.get_refrendo_dashboard_tym_v2(integer,integer,date,date,text,integer,integer,integer,text,text)') as refrendo_dashboard,
  to_regprocedure('public.get_refrendo_filtered_rows_tym(integer,integer,date,date,text,integer,text,text)') as refrendo_export,
  to_regprocedure('public.get_licencias_dashboard_tym_v1(date,date,integer,integer,text,integer,integer,text,text)') as licencias_dashboard,
  to_regprocedure('public.consume_rate_limit_tym(text,text,integer,integer,integer)') as rate_limit;

-- El primer administrador no se crea automáticamente porque requiere un correo
-- real de Supabase Auth. En una instalación nueva, después de crear ese usuario,
-- puede promoverse reemplazando el correo en esta sentencia y ejecutándola aparte:
-- update public.profiles_tym
-- set role = 'administrador', status = 'activo'
-- where lower(email) = lower('administrador@morelos.gob.mx');


-- =============================================================================
-- DATOS DE RECAUDACI?N DIARIA PARTICULAR/P?BLICA
-- Integraci?n a?adida el 2026-08-12
-- =============================================================================

-- Migraci?n incremental para una base que ya ejecut? el SQL completo del sistema.
-- Traslada la recaudaci?n diaria particular/p?blica que antes estaba incrustada
-- en el frontend a public.recaudacion_refrendo_diaria_tym.

begin;

create table if not exists public.recaudacion_refrendo_diaria_tym (
  id bigint generated by default as identity primary key,
  tipo_servicio text,
  concepto text not null,
  fecha date not null,
  monto numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recaudacion_refrendo_diaria_unica unique (concepto, fecha),
  constraint recaudacion_refrendo_diaria_monto_check check (monto >= 0)
);

alter table public.recaudacion_refrendo_diaria_tym
  add column if not exists tipo_servicio text;

update public.recaudacion_refrendo_diaria_tym
set tipo_servicio = case
  when upper(concepto) like '%PARTICULAR%' then 'particular'
  when upper(concepto) like '%P?BLICO%' then 'publico'
  else tipo_servicio
end
where tipo_servicio is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recaudacion_refrendo_diaria_tipo_check'
      and conrelid = 'public.recaudacion_refrendo_diaria_tym'::regclass
  ) then
    alter table public.recaudacion_refrendo_diaria_tym
      add constraint recaudacion_refrendo_diaria_tipo_check
      check (tipo_servicio in ('particular', 'publico'));
  end if;
end
$$;

insert into public.recaudacion_refrendo_diaria_tym
  (tipo_servicio, concepto, fecha, monto)
values
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-01'::date, 811438),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-02'::date, 2350076),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-03'::date, 1085834),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-04'::date, 1148188),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-05'::date, 5638798),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-06'::date, 7128927),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-07'::date, 7549406),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-08'::date, 9096820),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-09'::date, 7235142),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-10'::date, 1604361),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-11'::date, 1649044),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-12'::date, 8832327),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-13'::date, 7687262),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-14'::date, 8247989),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-15'::date, 8333563),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-16'::date, 6902034),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-17'::date, 1317431),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-18'::date, 1342471),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-19'::date, 6489519),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-20'::date, 7115791),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-21'::date, 7814447),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-22'::date, 7481848),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-23'::date, 6568013),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-24'::date, 1554264),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-25'::date, 1282344),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-26'::date, 6325726),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-27'::date, 7167378),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-28'::date, 9328254),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-29'::date, 7678979),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-30'::date, 8766794),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-01-31'::date, 3749658),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-01'::date, 770627),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-02'::date, 1528754),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-03'::date, 4584026),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-04'::date, 4847311),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-05'::date, 5321691),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-06'::date, 4324629),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-07'::date, 1218324),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-08'::date, 838084),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-09'::date, 5068297),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-10'::date, 4630550),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-11'::date, 5073044),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-12'::date, 4265184),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-13'::date, 3931702),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-14'::date, 969680),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-15'::date, 897300),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-16'::date, 4756135),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-17'::date, 4703608),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-18'::date, 5356527),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-19'::date, 5105027),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-20'::date, 4440777),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-21'::date, 1180349),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-22'::date, 810783),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-23'::date, 4929979),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-24'::date, 5137756),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-25'::date, 6088880),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-26'::date, 5001846),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-27'::date, 5702381),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-02-28'::date, 1854343),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-01'::date, 865618),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-02'::date, 3810756),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-03'::date, 4528100),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-04'::date, 3932415),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-05'::date, 3960560),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-06'::date, 3678732),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-07'::date, 1144602),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-08'::date, 924059),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-09'::date, 4786374),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-10'::date, 4511136),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-11'::date, 5176930),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-12'::date, 4271981),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-13'::date, 3921491),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-14'::date, 1119353),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-15'::date, 701642),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-16'::date, 1711986),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-17'::date, 4672253),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-18'::date, 5027930),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-19'::date, 5160746),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-20'::date, 4339969),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-21'::date, 1411262),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-22'::date, 1112198),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-23'::date, 6426844),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-24'::date, 6373087),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-25'::date, 6971986),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-26'::date, 6443737),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-27'::date, 7172114),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-28'::date, 2161332),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-29'::date, 1809051),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-30'::date, 6832349),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-03-31'::date, 11981564),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-01'::date, 11658236),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-02'::date, 2155040),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-03'::date, 921385),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-04'::date, 1088237),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-05'::date, 1006629),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-06'::date, 7280447),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-07'::date, 9525410),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-08'::date, 10303163),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-09'::date, 11464246),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-10'::date, 4343138),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-11'::date, 1115871),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-12'::date, 638963),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-13'::date, 10077415),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-14'::date, 11603864),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-15'::date, 11630694),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-16'::date, 9810384),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-17'::date, 10018583),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-18'::date, 1773613),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-19'::date, 1362362),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-20'::date, 8951935),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-21'::date, 11481022),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-22'::date, 11262230),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-23'::date, 10020522),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-24'::date, 8662711),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-25'::date, 3047089),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-26'::date, 991437),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-27'::date, 10743692),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-28'::date, 11676980),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-29'::date, 13560118),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-04-30'::date, 13188683),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-01'::date, 642590),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-02'::date, 507622),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-03'::date, 462010),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-04'::date, 1898871),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-05'::date, 6004052),
  ('particular', 'REFRENDO DE PLACAS SERVICIO PARTICULAR', '2026-05-06'::date, 1246714),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-02'::date, 735),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-05'::date, 735),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-06'::date, 13262),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-07'::date, 9555),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-08'::date, 11025),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-09'::date, 38268),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-11'::date, 3675),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-12'::date, 17704),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-13'::date, 19142),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-14'::date, 19917),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-15'::date, 14001),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-16'::date, 19126),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-18'::date, 1470),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-19'::date, 27417),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-20'::date, 18411),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-21'::date, 29550),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-22'::date, 37673),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-23'::date, 26460),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-24'::date, 4426),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-25'::date, 5880),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-26'::date, 55371),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-27'::date, 74015),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-28'::date, 105413),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-29'::date, 83337),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-30'::date, 120883),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-01-31'::date, 58065),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-02'::date, 9156),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-03'::date, 59388),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-04'::date, 75222),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-05'::date, 87503),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-06'::date, 46470),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-07'::date, 8351),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-08'::date, 1526),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-09'::date, 71618),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-10'::date, 51785),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-11'::date, 39632),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-12'::date, 31255),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-13'::date, 23619),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-14'::date, 3052),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-16'::date, 55615),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-17'::date, 59434),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-18'::date, 85392),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-19'::date, 70861),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-20'::date, 79258),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-21'::date, 3052),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-22'::date, 6104),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-23'::date, 71672),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-24'::date, 95280),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-25'::date, 93795),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-26'::date, 67815),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-27'::date, 71643),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-02-28'::date, 14488),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-01'::date, 6095),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-02'::date, 68557),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-03'::date, 63982),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-04'::date, 65546),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-05'::date, 95220),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-06'::date, 75470),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-07'::date, 763),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-08'::date, 2289),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-09'::date, 73111),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-10'::date, 71605),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-11'::date, 66317),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-12'::date, 57180),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-13'::date, 68642),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-14'::date, 6092),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-15'::date, 3052),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-16'::date, 7630),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-17'::date, 91495),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-18'::date, 73206),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-19'::date, 47292),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-20'::date, 59501),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-21'::date, 3052),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-22'::date, 763),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-23'::date, 72434),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-24'::date, 80083),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-25'::date, 77734),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-26'::date, 97606),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-27'::date, 120409),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-28'::date, 9156),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-29'::date, 8393),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-30'::date, 103647),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-03-31'::date, 138016),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-01'::date, 333687),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-02'::date, 11044),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-03'::date, 26646),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-04'::date, 1004),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-05'::date, 2008),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-06'::date, 281728),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-07'::date, 402565),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-08'::date, 617967),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-09'::date, 674913),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-10'::date, 118178),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-11'::date, 9072),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-12'::date, 11088),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-13'::date, 753517),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-14'::date, 333451),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-15'::date, 831585),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-16'::date, 522603),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-17'::date, 963269),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-19'::date, 3024),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-20'::date, 457821),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-21'::date, 489111),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-22'::date, 455002),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-23'::date, 610469),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-24'::date, 1113733),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-25'::date, 19320),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-26'::date, 15972),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-27'::date, 664602),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-28'::date, 886739),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-29'::date, 1044615),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-04-30'::date, 1809906),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-01'::date, 7070),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-02'::date, 8080),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-03'::date, 2020),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-04'::date, 4040),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-05'::date, 397685),
  ('publico', 'REFRENDO DE PLACAS SERVICIO PÚBLICO', '2026-05-06'::date, 129782)
on conflict (concepto, fecha) do update
set
  tipo_servicio = excluded.tipo_servicio,
  monto = excluded.monto,
  updated_at = now();

alter table public.recaudacion_refrendo_diaria_tym
  alter column tipo_servicio set not null;

create index if not exists recaudacion_refrendo_diaria_tipo_fecha_idx
  on public.recaudacion_refrendo_diaria_tym(fecha desc, tipo_servicio);

alter table public.recaudacion_refrendo_diaria_tym enable row level security;
drop policy if exists recaudacion_refrendo_diaria_read_authorized
  on public.recaudacion_refrendo_diaria_tym;
create policy recaudacion_refrendo_diaria_read_authorized
  on public.recaudacion_refrendo_diaria_tym
  for select to authenticated
  using (public.has_section_permission_tym(auth.uid(), 'dashboard-2', 'view'));

revoke all on public.recaudacion_refrendo_diaria_tym from public, anon;
grant select on public.recaudacion_refrendo_diaria_tym to authenticated, service_role;
grant insert, update, delete on public.recaudacion_refrendo_diaria_tym to service_role;
grant usage, select on all sequences in schema public to service_role;

commit;

-- Verificaci?n esperada:
-- particular = 126 filas; p?blico = 118 filas; total = 244 filas.
select
  tipo_servicio,
  count(*) as filas,
  sum(monto) as monto_total,
  min(fecha) as fecha_inicial,
  max(fecha) as fecha_final
from public.recaudacion_refrendo_diaria_tym
where fecha between date '2026-01-01' and date '2026-12-31'
group by tipo_servicio
order by tipo_servicio;
