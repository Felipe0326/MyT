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
