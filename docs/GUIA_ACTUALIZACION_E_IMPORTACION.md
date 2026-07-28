# Guía de actualización TyM v3

## 1. Actualizar la base actual

En Supabase SQL Editor abre y ejecuta completo:

`supabase/migrations/202607220002_tym_update.sql`

Si ya habías ejecutado esa actualización antes de recibir la versión con todas las columnas, ejecuta ahora:

`supabase/migrations/202607220003_nps_all_columns.sql`

Usa esta migración porque tu base ya tiene las tablas `_tym`. No vuelvas a ejecutar el esquema completo solo para actualizar. La actualización conserva los perfiles, permisos y respuestas existentes.

Al terminar, en `app_sections_tym` deben aparecer estos tres nombres visibles:

- NPS
- Refrendos
- Trámites

La consulta comentada al final de la migración permite revisar los perfiles que se copiaron anteriormente. No borres ninguno hasta confirmar que no pertenece a esta aplicación.

## 2. Cargar el CSV NPS

### Opción recomendada: importador por lotes

Configura `.env.local` y ejecuta desde la carpeta del proyecto:

```powershell
npm install
npm run import:nps -- "C:\ruta\nps_citas_unificado.csv"
```

El proceso sube lotes de 500 registros, reintenta de forma segura mediante `submit_id` y registra la huella del archivo en `data_imports_tym`.

### Opción manual: Table Editor

El archivo entregado `nps_citas_supabase_tym.csv` ya está normalizado y conserva las 22 columnas originales. En Supabase:

1. Abre Table Editor.
2. Selecciona `nps_responses_tym`.
3. Elige Insert > Import data from CSV.
4. Selecciona `nps_citas_supabase_tym.csv` y confirma el mapeo de columnas.

El SQL Editor del navegador no puede leer directamente una ruta `C:\...` de tu computadora.

## 3. Ejecutar el proyecto

Requiere Node.js 22.13 o posterior:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Completa `.env.local` antes de iniciar. La llave secreta solo va en el servidor y nunca debe usar el prefijo `NEXT_PUBLIC_`.

## 4. Notas de diagnóstico

- Un `GET /api/auth/session 401` al abrir la pantalla sin sesión es normal: la aplicación está comprobando si ya existe una sesión.
- La directiva `unsafe-eval` se habilita solamente en `localhost` para que funcione el modo de desarrollo. Producción conserva una CSP más estricta.
- Antes de producción rota la `SUPABASE_SERVICE_ROLE_KEY` que se compartió durante el desarrollo y guarda el reemplazo en los secretos del servidor.
