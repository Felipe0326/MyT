# Configuración V4.9: correo y seguridad

Esta versión sustituye a la V4.8. Está preparada para que solamente se instale
el SQL acumulativo y se espere la entrega de los datos SMTP.

## 1. SQL único

Ejecuta una sola vez, completo, en Supabase SQL Editor:

```text
SQL_EJECUTAR_V4_9_CORREO_Y_SEGURIDAD.sql
```

El archivo es idempotente y acumulativo:

- agrega los tokens seguros de restablecimiento de contraseña de la V4.8;
- agrega los límites distribuidos de intentos de la V4.9;
- no elimina usuarios, perfiles, NPS ni Refrendos;
- no cambia las contraseñas existentes.

No necesitas ejecutar antes `202607270001_password_resets_tym.sql`.

## 2. Variables que ya utiliza el sistema

Conserva las variables actuales de Supabase:

```dotenv
SUPABASE_URL=https://DOMINIO-SUPABASE
SUPABASE_ANON_KEY=CLAVE_PUBLICABLE
SUPABASE_SERVICE_ROLE_KEY=SECRETO-SOLO-DEL-SERVIDOR
APP_URL=https://URL-PUBLICA-EXACTA
```

En producción, `APP_URL` es obligatoria y debe utilizar HTTPS. Esto evita que
un encabezado de dominio alterado produzca enlaces de invitación falsos.

Opcionalmente puede agregarse:

```dotenv
RATE_LIMIT_SECRET=SECRETO-ALEATORIO-DE-32-O-MAS-CARACTERES
```

No es una credencial externa obligatoria. Si se omite, la aplicación usa
internamente `SUPABASE_SERVICE_ROLE_KEY` como clave HMAC. Ni la IP ni el correo
se guardan directamente en la tabla de límites.

## 3. Datos SMTP pendientes

Solicitar a TI:

- host o nombre DNS del SMTP institucional;
- puerto;
- si usa TLS directo o STARTTLS;
- usuario y contraseña o confirmación de relay por IP;
- autorización de red desde el servidor de la aplicación;
- certificado y cadena de confianza válidos para el nombre del SMTP.

Configurar como variables protegidas del servidor:

```dotenv
SMTP_HOST=VALOR-DE-TI
SMTP_PORT=VALOR-DE-TI
SMTP_SECURE=VALOR-DE-TI
SMTP_REQUIRE_TLS=true
SMTP_USER=tlamati@morelos.gob.mx
SMTP_PASS=VALOR-DE-PASSBOLT

EMAIL_FROM=Movilidad y Transporte <tlamati@morelos.gob.mx>
EMAIL_REPLY_TO=tlamati@morelos.gob.mx
```

Referencias habituales, que TI debe confirmar:

- puerto 465: `SMTP_SECURE=true`;
- puerto 587: `SMTP_SECURE=false` y `SMTP_REQUIRE_TLS=true`.

La V4.9 exige TLS 1.2 o posterior y valida el certificado. Si el SMTP utiliza
una autoridad certificadora interna, Infraestructura debe instalar esa CA en
el servidor; no se debe desactivar la validación.

## 4. Límites instalados

- Login por IP: 100 intentos en 10 minutos para tolerar redes institucionales compartidas.
- Login por cuenta: 8 intentos en 15 minutos.
- Solicitud de recuperación por IP: 10 en 15 minutos.
- Solicitud de recuperación por cuenta: 3 por hora.
- Uso de un enlace de invitación o recuperación: 6 intentos por token.
- Acciones de invitación: 60 por administrador y 5 por destinatario por hora.

Los límites son atómicos en PostgreSQL y se comparten entre todas las
instancias. Al excederlos, la API devuelve `429`. Si la migración no está
instalada, devuelve `503` en vez de continuar sin protección.

El reverse proxy de Morelos debe sustituir, no acumular, los encabezados
`X-Forwarded-For` o `X-Real-IP` para que la aplicación reciba la IP real.

## 5. Comportamiento sin SMTP

- Crear y reenviar una invitación sigue mostrando el enlace manual al
  administrador.
- La recuperación pública responde de manera neutra, pero no expone un enlace.
- Cuando se agreguen las variables SMTP, crear usuario, reenviar invitación y
  restablecer contraseña enviarán el correo desde los mismos botones.

## 6. Prueba de aceptación

1. Ejecutar el SQL único y confirmar las dos tablas mostradas al final.
2. Iniciar sesión con un usuario válido.
3. Crear una invitación y comprobar el enlace manual mientras falta SMTP.
4. Agregar SMTP en un ambiente de prueba.
5. Crear y reenviar una invitación; verificar que el enlace anterior ya no sirve.
6. Solicitar un restablecimiento y verificar la recepción.
7. Cambiar la contraseña y confirmar que las sesiones anteriores se cerraron.
8. Probar intentos repetidos y confirmar una respuesta `429`.
