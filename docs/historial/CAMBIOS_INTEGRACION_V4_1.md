# Integración v4.1

## Una sola conexión de Supabase

NPS y Refrendos usan el mismo proyecto de Supabase. Ya no existen variables
`NEXT_PUBLIC_REFRENDOS_*` ni credenciales incrustadas en el navegador.

- NPS: tabla `public.nps_responses_tym`
- Refrendos: tabla `public.refrendo_diario`
- Autenticación y permisos: tablas `*_tym`

La sección Refrendos consulta `/api/refrendos`; esa ruta valida la sesión y el
permiso de la sección antes de consultar Supabase desde el servidor.

## Correcciones de ejecución local

- Se deshabilitó la optimización de imágenes para archivos locales, evitando el
  error `Cannot read properties of undefined (reading 'fetch')` de vinext.
- El Worker ahora verifica que existan los bindings `ASSETS` e `IMAGES`.
- Se retiró la importación externa de Google Fonts que era bloqueada por CSP.
- Se agregó `public/favicon.ico`.

## Configuración

Copia `.env.example` como `.env.local` y sustituye los tres valores de Supabase
por las credenciales reales del mismo proyecto:

```powershell
Copy-Item .env.example .env.local
```

Después reinicia el servidor:

```powershell
npm run dev
```
