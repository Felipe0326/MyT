-- Actualización TyM v2 -> v3
-- Ejecutar completa en Supabase SQL Editor si ya se instaló la primera versión.
-- No elimina perfiles ni respuestas NPS existentes.

begin;

alter table public.nps_responses_tym
  add column if not exists survey_name text not null default 'Encuesta NPS';

alter table public.nps_responses_tym
  add column if not exists booking_id bigint,
  add column if not exists form_id bigint,
  add column if not exists team_id bigint,
  add column if not exists team_branch_id bigint,
  add column if not exists booking_folio text,
  add column if not exists booking_status text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists check_in_at timestamptz,
  add column if not exists check_out_at timestamptz,
  add column if not exists entity_id bigint,
  add column if not exists entity_type text,
  add column if not exists booking_created_at timestamptz;

alter table public.nps_responses_tym
  alter column estrellas_facilidad_uso drop not null;

do $$ begin
  alter table public.nps_responses_tym
    add constraint nps_survey_name_length check (char_length(survey_name) between 1 and 250);
exception when duplicate_object then null;
end $$;

create index if not exists nps_responses_tym_survey_name_idx
  on public.nps_responses_tym(survey_name);
create index if not exists nps_responses_tym_booking_id_idx
  on public.nps_responses_tym(booking_id);
create index if not exists nps_responses_tym_form_id_idx
  on public.nps_responses_tym(form_id);

create or replace function public.handle_auth_user_profile_tym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Evita copiar a TyM usuarios de otros sistemas que comparten el mismo Auth.
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

revoke all on function public.handle_auth_user_profile_tym() from public, anon, authenticated;

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
grant execute on function public.get_nps_dashboard_tym(text, text, date, date, integer, integer) to authenticated, service_role;

commit;

-- REVISIÓN SEGURA DE PERFILES HEREDADOS (solo consulta, no borra nada):
-- select p.id, p.email, p.full_name, p.role,
--        coalesce(u.raw_app_meta_data ->> 'system_code', '(sin marca)') as system_code
-- from public.profiles_tym p
-- join auth.users u on u.id = p.id
-- order by p.created_at;
-- Revisa la lista antes de retirar manualmente cualquier perfil que no pertenezca a TyM.
