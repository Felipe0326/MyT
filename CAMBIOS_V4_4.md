# Cambios v4.4

## NPS

- Conserva únicamente los filtros solicitados: Dependencia, Sucursal y Rango de fecha.
- La API consulta `get_nps_dashboard_tym_v2`.
- KPIs y gráficas se calculan con todos los registros que cumplen los filtros.
- La tabla se pagina en servidor y permite recorrer todo el resultado filtrado.
- El ordenamiento se ejecuta en PostgreSQL sobre todo el conjunto filtrado.
- Las cabeceras usan el formato visual `↑ Campo ↓`.
- La exportación usa `get_nps_filtered_rows_tym` y descarga todos los registros filtrados, no solo la página visible.

## Refrendos

- La API consulta `get_refrendo_dashboard_tym_v2`.
- Se agregaron filtros por mes, rango de fecha, movimiento y hora.
- KPIs y gráficas usan todos los registros que cumplen los filtros.
- La tabla muestra el detalle original de `refrendo_diario`, paginado en servidor.
- La tabla permite ordenar por fecha, movimiento, hora, total, digital y tradicional con el formato `↑ Campo ↓`.
- La exportación usa `get_refrendo_filtered_rows_tym` y descarga todos los registros filtrados.

## SQL

Ejecutar antes de probar el proyecto:

`SQL_VISTAS_FUNCIONES_NPS_REFRENDOS_TODOS_REGISTROS.sql`

El mismo archivo también está en:

`supabase/migrations/202607230006_nps_refrendos_todos_registros.sql`
