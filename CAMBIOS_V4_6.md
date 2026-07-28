# Cambios v4.6

## Login
- Se eliminó el texto "Acceso protegido y auditable".
- El encabezado ahora muestra **Bienvenido/a** centrado.
- El texto secundario aparece en menor tamaño: "Al sistema de consulta de información de trámites, refrendos y experiencia ciudadana NPS.".

## Tablero NPS
- Los meses ya no usan contenedores tipo botón; ahora son pestañas de texto con línea activa.
- Dependencias y sucursales usan listas buscables y con desplazamiento.
- La lista de sucursales no tiene límite visual y muestra el número total de opciones recibidas.
- Se agregó filtro de recomendación.
- Seleccionar un mes de la gráfica, una sección de la gráfica circular o una fila de la tabla actualiza todo el tablero.
- Los filtros activos se muestran como etiquetas removibles.

## Tablero Refrendos
- Seleccionar un día en la gráfica principal filtra todo el tablero.
- Seleccionar una fila de la tabla aplica fecha, movimiento y hora como filtros.
- Seleccionar un mes en la gráfica de recaudación cambia el mes del tablero.
- Seleccionar un día en la gráfica de pagos aplica esa fecha al tablero.

## SQL requerido
Como la versión anterior del SQL ya fue ejecutada, solo se debe ejecutar una vez:

`SQL_ACTUALIZACION_V4_6_FILTROS_INTERACTIVOS.sql`

Este archivo crea las funciones NPS v3 necesarias para filtrar por recomendación. No elimina tablas ni registros.
