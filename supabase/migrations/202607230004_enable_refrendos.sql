-- Habilita el tablero de Refrendos en instalaciones existentes.
begin;

update public.app_sections_tym
set
  title = 'Refrendos',
  description = 'Consulta y seguimiento de datos de refrendos.',
  icon = 'refresh-cw',
  availability = 'disponible',
  is_active = true,
  updated_at = now()
where slug = 'dashboard-2';

commit;
