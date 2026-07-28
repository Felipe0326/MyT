# Cambios v4.7 responsive

Esta versión conserva las consultas, filtros, API, SQL y flujo de n8n de la versión v4.6. Los cambios son de interfaz y adaptación a dispositivos.

## Cambios principales

- Ajuste explícito del viewport para celulares, tabletas y pantallas con áreas seguras.
- Prevención de desbordamiento horizontal global.
- Encabezados de NPS y Refrendos acomodados debajo del header móvil.
- Navegación de meses y pestañas con desplazamiento horizontal táctil.
- Filtros en una columna para teléfonos, dos para tabletas y distribución completa en escritorio.
- Selector buscable de dependencia y sucursal adaptado como ventana central en teléfonos.
- KPIs, tarjetas, títulos, botones y gráficas con tamaños progresivos.
- Tablas de NPS y Refrendos convertidas en tarjetas legibles en teléfono; la tabla completa se conserva desde tablet horizontal/escritorio.
- Paginación y exportación acomodadas en una o dos columnas según el ancho.
- Login, perfil, sidebar y módulo de usuarios reforzados para pantallas pequeñas.
- Diagnóstico Ejecutivo y Hoja de Ruta ajustados para evitar cortes y desbordamientos.
- Botón de actualización de Refrendos con etiqueta visible desde tableta.

## Instalación

1. Conserva tu archivo `.env.local` actual; no viene incluido en este ZIP por seguridad.
2. Sustituye los archivos del proyecto por los de esta versión.
3. Ejecuta `npm install` o `npm ci`.
4. Reinicia el proyecto con `npm run dev`.

No se requiere ejecutar un SQL nuevo ni modificar n8n para aplicar estos cambios responsive.
