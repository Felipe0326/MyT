-- Ampliación NPS TyM: conserva todas las columnas del CSV unificado.
-- Es segura para una base que ya ejecutó la actualización v2 -> v3.
-- No elimina ni reemplaza registros existentes.

begin;

alter table public.nps_responses_tym
  add column if not exists booking_id bigint,
  add column if not exists form_id bigint,
  add column if not exists survey_name text not null default 'Encuesta NPS',
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

-- En el archivo original hay respuestas sin calificación de facilidad.
-- NULL conserva esa diferencia; convertirlas a cero alteraría el promedio.
alter table public.nps_responses_tym
  alter column estrellas_facilidad_uso drop not null;

do $$ begin
  alter table public.nps_responses_tym
    add constraint nps_booking_folio_length check (booking_folio is null or char_length(booking_folio) <= 100);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.nps_responses_tym
    add constraint nps_booking_status_length check (booking_status is null or char_length(booking_status) <= 100);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.nps_responses_tym
    add constraint nps_entity_type_length check (entity_type is null or char_length(entity_type) <= 100);
exception when duplicate_object then null;
end $$;

create index if not exists nps_responses_tym_booking_id_idx
  on public.nps_responses_tym(booking_id);
create index if not exists nps_responses_tym_form_id_idx
  on public.nps_responses_tym(form_id);

commit;

-- Comprobación opcional: debe mostrar las 22 columnas originales más
-- import_id, created_at y updated_at, que son columnas internas del sistema.
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'nps_responses_tym'
-- order by ordinal_position;
