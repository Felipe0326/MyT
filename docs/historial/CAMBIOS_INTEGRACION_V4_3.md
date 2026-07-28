# Cambios v4.3

## NPS

- Se retiraron los filtros no solicitados de **Recomendación** y **Búsqueda general**.
- Se conservaron únicamente los filtros de **Dependencia**, **Sucursal** y **Rango de fecha**.
- Se mantuvo el acceso rápido de enero a julio de 2026.
- El tablero ya no descarga todos los registros NPS. Ahora consume la función `public.get_nps_dashboard_tym_v2`, que devuelve métricas, tendencia, catálogos y una sola página de comentarios.
- El ordenamiento de la tabla se procesa en PostgreSQL.
- Las flechas se muestran con el formato solicitado: `↑ Campo ↓`.
- La gráfica de evolución usa área, degradado, puntos activos y tooltip.
- La distribución de respuestas usa dona interactiva, porcentaje central y cantidades reales.
- Los contenedores usan todo el ancho disponible del área de trabajo.

## Refrendos

- Se agregó la vista `public.vw_refrendo_dashboard_diario`, agrupada por fecha y hora.
- La API dejó de descargar `select=*` y hasta 200,000 filas de `public.refrendo_diario`.
- La consulta usa únicamente las columnas requeridas por el tablero y el año 2026.
- Se agregó un índice de consulta para año, mes, fecha y hora.
- Las tablas de Refrendos muestran las flechas con el formato `↑ Campo ↓`.

## SQL que debe ejecutarse

Ejecutar en Supabase SQL Editor:

```text
supabase/migrations/202607230005_optimize_nps_refrendos.sql
```

La aplicación requiere esa migración antes de probar la versión 4.3.
