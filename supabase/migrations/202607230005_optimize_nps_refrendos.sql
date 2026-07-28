-- Optimización de los tableros NPS y Refrendos.
-- Ejecutar después de las migraciones anteriores del sistema TYM.

begin;

-- -----------------------------------------------------------------------------
-- NPS: índices orientados a los filtros reales del tablero.
-- -----------------------------------------------------------------------------
create index if not exists nps_responses_tym_date_dependencia_sucursal_idx
  on public.nps_responses_tym (survey_submitted_at desc, dependencia, sucursal_branch);

create index if not exists nps_responses_tym_comment_sort_idx
  on public.nps_responses_tym (survey_submitted_at desc, submit_id desc)
  include (dependencia, sucursal_branch, recomienda_citas, estrellas_facilidad_uso, estrellas_trato_personal);

-- La función devuelve métricas, serie mensual, catálogos de filtros y únicamente
-- la página solicitada de comentarios. Así el navegador no descarga miles de filas.
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
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 10), 100);
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
  if not public.has_section_permission_tym(auth.uid(), 'dashboard-nps', 'view') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  with filtered as materialized (
    select
      r.submit_id,
      r.survey_name,
      r.dependencia,
      r.sucursal_branch,
      r.survey_submitted_at,
      r.comentario_libre,
      r.recomienda_citas,
      coalesce(r.estrellas_facilidad_uso, 0)::numeric as estrellas_facilidad_uso,
      coalesce(r.estrellas_trato_personal, 0)::numeric as estrellas_trato_personal,
      (
        coalesce(r.estrellas_facilidad_uso, 0)::numeric
        + coalesce(r.estrellas_trato_personal, 0)::numeric
      ) / 2.0 as score
    from public.nps_responses_tym r
    where (p_dependencia is null or r.dependencia = p_dependencia)
      and (p_sucursal is null or r.sucursal_branch = p_sucursal)
      and (p_date_from is null or r.survey_submitted_at >= p_date_from::timestamptz)
      and (p_date_to is null or r.survey_submitted_at < (p_date_to + 1)::timestamptz)
  ),
  metrics as (
    select
      count(*)::integer as total,
      coalesce(
        round(
          100.0 * sum(case when recomienda_citas then 1 else -1 end)
          / nullif(count(*), 0)
        ),
        0
      )::integer as nps,
      coalesce(round(avg(estrellas_facilidad_uso), 1), 0) as facilidad,
      coalesce(round(avg(estrellas_trato_personal), 1), 0) as trato,
      count(*) filter (where recomienda_citas)::integer as promotores,
      count(*) filter (where not recomienda_citas)::integer as detractores
    from filtered
  ),
  trend_rows as (
    select
      date_trunc('month', survey_submitted_at) as month_start,
      count(*)::integer as total,
      round(
        100.0 * sum(case when recomienda_citas then 1 else -1 end)
        / nullif(count(*), 0)
      )::integer as nps
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
      estrellas_trato_personal,
      score
    from filtered
    order by
      case when v_sort = 'date' and v_direction = 'asc' then survey_submitted_at end asc,
      case when v_sort = 'date' and v_direction = 'desc' then survey_submitted_at end desc,
      case when v_sort = 'dependencia' and v_direction = 'asc' then lower(dependencia || ' ' || sucursal_branch) end asc,
      case when v_sort = 'dependencia' and v_direction = 'desc' then lower(dependencia || ' ' || sucursal_branch) end desc,
      case when v_sort = 'feedback' and v_direction = 'asc' then lower(comentario_libre) end asc,
      case when v_sort = 'feedback' and v_direction = 'desc' then lower(comentario_libre) end desc,
      case when v_sort = 'score' and v_direction = 'asc' then score end asc,
      case when v_sort = 'score' and v_direction = 'desc' then score end desc,
      submit_id desc
    limit v_page_size
    offset (v_page - 1) * v_page_size
  )
  select jsonb_build_object(
    'metrics', (select to_jsonb(m) from metrics m),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'month', to_char(t.month_start, 'YYYY-MM'),
          'nps', t.nps,
          'total', t.total
        )
        order by t.month_start
      )
      from trend_rows t
    ), '[]'::jsonb),
    'dependencias', coalesce((
      select jsonb_agg(value order by value)
      from (
        select distinct dependencia as value
        from public.nps_responses_tym
      ) d
    ), '[]'::jsonb),
    'sucursales', coalesce((
      select jsonb_agg(value order by value)
      from (
        select distinct sucursal_branch as value
        from public.nps_responses_tym
        where p_dependencia is null or dependencia = p_dependencia
      ) s
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(to_jsonb(c))
      from comments_page c
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (select total from metrics),
      'totalPages', greatest(
        1,
        ceil((select total from metrics)::numeric / v_page_size)::integer
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_nps_dashboard_tym_v2(text, text, date, date, integer, integer, text, text)
  from public, anon;
grant execute on function public.get_nps_dashboard_tym_v2(text, text, date, date, integer, integer, text, text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Refrendos: el tablero no utiliza el detalle de movimiento. La vista concentra
-- los registros por fecha y hora, reduciendo considerablemente el volumen enviado.
-- -----------------------------------------------------------------------------
create index if not exists idx_refrendo_diario_dashboard
  on public.refrendo_diario (anio, mes, fecha, hora)
  include (total_registros, es_digital, es_tradicional);

create or replace view public.vw_refrendo_dashboard_diario
with (security_invoker = true)
as
select
  min(id) as id,
  fecha,
  coalesce(anio, extract(year from fecha)::integer) as anio,
  coalesce(mes, extract(month from fecha)::integer) as mes,
  coalesce(dia, extract(day from fecha)::integer) as dia,
  max(dia_semana) as dia_semana,
  hora,
  sum(coalesce(total_registros, 0))::bigint as total_registros,
  sum(coalesce(es_digital, 0))::bigint as es_digital,
  sum(coalesce(es_tradicional, 0))::bigint as es_tradicional,
  case
    when sum(coalesce(total_registros, 0)) = 0 then 0
    else round(
      100.0 * sum(coalesce(es_digital, 0))
      / sum(coalesce(total_registros, 0)),
      2
    )
  end as porcentaje_digital,
  case
    when sum(coalesce(total_registros, 0)) = 0 then 0
    else round(
      100.0 * sum(coalesce(es_tradicional, 0))
      / sum(coalesce(total_registros, 0)),
      2
    )
  end as porcentaje_tradicional,
  count(*)::integer as filas_origen,
  max(updated_at) as updated_at
from public.refrendo_diario
group by
  fecha,
  coalesce(anio, extract(year from fecha)::integer),
  coalesce(mes, extract(month from fecha)::integer),
  coalesce(dia, extract(day from fecha)::integer),
  hora;

grant select on public.vw_refrendo_dashboard_diario to authenticated, service_role;

commit;
