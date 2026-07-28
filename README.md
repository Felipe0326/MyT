# Movilidad y Transporte | Gobierno de Morelos

Aplicación institucional para consultar NPS, Refrendos y Trámites, administrar usuarios y aplicar permisos por sección. Usa Next.js/Vinext, TypeScript, React y un Supabase autohospedado.

## Seguridad importante

`SUPABASE_SERVICE_ROLE_KEY` concede acceso privilegiado y solamente se utiliza en rutas del servidor y en el importador administrativo. Nunca debe comenzar con `NEXT_PUBLIC_`, guardarse en Git ni enviarse al navegador.

La llave compartida durante el desarrollo debe rotarse antes de publicar. Después de rotarla, configura el valor nuevo únicamente en los secretos del servidor de la aplicación.

## Actualizar la base que ya existe

Ejecuta completo `supabase/migrations/202607220002_tym_update.sql` en Supabase SQL Editor. Esta actualización:

- conserva todos los perfiles y datos existentes;
- cambia los nombres visibles a NPS, Refrendos y Trámites;
- agrega `survey_name` a `nps_responses_tym`;
- evita que nuevos usuarios de otros sistemas compartidos se copien a `profiles_tym`.

Al final del archivo hay una consulta de solo lectura para revisar los perfiles heredados. La migración no borra ninguno automáticamente.

Si ya habías ejecutado la versión anterior de esa actualización, ejecuta además `supabase/migrations/202607220003_nps_all_columns.sql` para agregar las 22 columnas originales del CSV. Para una instalación nueva ejecuta solamente `supabase/migrations/202607220001_initial_schema.sql`.

Para habilitar el correo, el restablecimiento y los límites de seguridad de la V4.9 ejecuta una sola vez:

```text
SQL_EJECUTAR_V4_9_CORREO_Y_SEGURIDAD.sql
```

Este archivo acumulativo incluye la migración de recuperación de la V4.8 y los límites de intentos de la V4.9. No borra ni modifica usuarios, NPS o Refrendos.

## Configurar Supabase

1. En Authentication, desactiva el registro público por correo.
2. Configura expiración JWT corta, rotación de refresh tokens y detección de reutilización.
3. Crea manualmente el primer usuario en Authentication > Users y ejecuta la consulta comentada al final de la migración inicial para inscribirlo como administrador TyM.
4. Configura MFA para administradores, limitación de intentos y correo SMTP institucional en el Supabase autohospedado cuando se publique.

Las invitaciones de la aplicación duran 48 horas. Solo se guarda el hash SHA-256, son de un uso y cada reenvío invalida el enlace anterior.

## Ejecutar localmente

Requiere Node.js 22.13 o posterior. Copia `.env.example` como `.env.local`, completa los valores y ejecuta:

```powershell
npm install
npm run dev
```

## Importar NPS

La opción recomendada usa lotes de 500, hace `upsert` por `submit_id` y registra la importación:

```powershell
npm run import:nps -- "C:\ruta\nps_citas_unificado.csv"
```

Para preparar un CSV reducido que se pueda cargar desde Table Editor > `nps_responses_tym` > Insert > Import data from CSV:

```powershell
npm run prepare:nps -- "C:\ruta\nps_citas_unificado.csv" "C:\ruta\nps_citas_supabase_tym.csv"
```

Los dos procesos reparan caracteres, normalizan fechas, conservan las 22 columnas originales —incluidos folio e identificadores—, validan calificaciones y evitan duplicados por `submit_id`. Las columnas se protegen con la misma RLS del tablero NPS.

## Roles y permisos

- `administrador`: consulta todo y administra usuarios.
- `editor`: consulta y edita solo las secciones asignadas.
- `consulta`: acceso de lectura a las secciones asignadas.

Los permisos se validan en la interfaz, en las rutas del servidor y en PostgreSQL mediante RLS.

## Correo

La V4.9 envía automáticamente invitaciones y restablecimientos mediante SMTP institucional. La configuración se carga exclusivamente como variables o secretos del servidor:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO` (opcional)

El puerto 465 normalmente usa `SMTP_SECURE=true`. El puerto 587 normalmente usa `SMTP_SECURE=false` y `SMTP_REQUIRE_TLS=true`; TI debe confirmar los valores institucionales.

SMTP tiene prioridad. Si no está configurado y existen `RESEND_API_KEY` y `EMAIL_FROM`, se usa Resend como respaldo. Si no existe ningún proveedor, las invitaciones conservan el enlace manual para el administrador. Los restablecimientos de contraseña no revelan el enlace en la respuesta pública y requieren un proveedor configurado.

Consulta `CONFIGURACION_V4_9_CORREO_Y_SEGURIDAD.md` antes de publicar.

## Verificación

```powershell
npm run lint
npm test
```

La aplicación usa cookies `HttpOnly`, `Secure` y `SameSite=Strict`, CSRF, cierre tras 30 minutos de inactividad, duración máxima de ocho horas, rotación de tokens, RLS, auditoría, encabezados defensivos y límites distribuidos de intentos.

## Supabase compartido por NPS y Refrendos

Las dos secciones usan la misma URL y las mismas credenciales del proyecto Supabase. NPS consulta `nps_responses_tym` y Refrendos consulta `refrendo_diario`. Refrendos se obtiene mediante `/api/refrendos`, por lo que no requiere variables `NEXT_PUBLIC_REFRENDOS_*`.

## Optimización v4.3

Antes de ejecutar esta versión, aplique en Supabase:

```text
supabase/migrations/202607230005_optimize_nps_refrendos.sql
```

Esta migración crea la función rápida de NPS y la vista resumida de Refrendos.
