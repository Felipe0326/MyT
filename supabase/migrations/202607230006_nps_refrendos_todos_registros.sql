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
