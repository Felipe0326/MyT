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
