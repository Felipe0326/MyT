# Configuración de correo V4.8

La aplicación ya está preparada para enviar automáticamente:

1. Invitación al crear un usuario.
2. Enlace nuevo al reenviar una invitación.
3. Enlace de restablecimiento de contraseña solicitado desde el acceso.

No se agrega un segundo botón: la entrega se ejecuta dentro de la misma acción.

## Datos pendientes de TI

Solicitar:

- Host o nombre DNS del servidor SMTP.
- Puerto SMTP.
- Confirmación de SSL/TLS directo o STARTTLS.
- Confirmación de que el servidor donde se despliegue la aplicación puede conectarse al SMTP OnPrem.
- Reglas de red, relay o lista de autorización, si aplica.

Ya se cuenta con la identidad `tlamati@morelos.gob.mx` y su contraseña en Passbolt. La contraseña no debe copiarse a este repositorio.

## Secretos del servidor

Configurar en el entorno de despliegue o en las variables protegidas de GitLab:

```dotenv
APP_URL=https://URL-PUBLICA-DE-LA-PLATAFORMA

SMTP_HOST=VALOR-PROPORCIONADO-POR-TI
SMTP_PORT=VALOR-PROPORCIONADO-POR-TI
SMTP_SECURE=VALOR-PROPORCIONADO-POR-TI
SMTP_REQUIRE_TLS=VALOR-PROPORCIONADO-POR-TI
SMTP_USER=tlamati@morelos.gob.mx
SMTP_PASS=VALOR-DE-PASSBOLT

EMAIL_FROM=Movilidad y Transporte <tlamati@morelos.gob.mx>
EMAIL_REPLY_TO=tlamati@morelos.gob.mx
```

Configuraciones habituales, únicamente como referencia:

- Puerto 465: `SMTP_SECURE=true`.
- Puerto 587: `SMTP_SECURE=false` y `SMTP_REQUIRE_TLS=true`.

No se debe asumir ninguna de las dos; TI debe confirmar la configuración.

## Base de datos

Ejecutar una sola vez:

```text
supabase/migrations/202607270001_password_resets_tym.sql
```

La migración agrega los tokens de recuperación. Conserva todos los datos existentes.

## Comportamiento mientras faltan datos

- Crear y reenviar invitaciones continúa funcionando y muestra un enlace manual al administrador.
- La recuperación pública responde de manera neutra, pero no genera un enlace utilizable hasta que exista un proveedor de correo.
- En cuanto se agreguen los secretos SMTP, los mismos botones enviarán automáticamente sin otro cambio de código.

## Prueba de aceptación

1. Crear un usuario de prueba y confirmar que recibe la invitación.
2. Reenviar la invitación y comprobar que el enlace anterior queda invalidado.
3. Aceptar la invitación y crear la cuenta.
4. Usar “¿Olvidaste tu contraseña?” y confirmar la recepción.
5. Cambiar la contraseña y comprobar que las sesiones anteriores quedan cerradas.
6. Revisar el remitente, los registros del SMTP y la carpeta de correo no deseado.
