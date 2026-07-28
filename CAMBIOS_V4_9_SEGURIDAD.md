# Cambios V4.9

## Protección de solicitudes

- Límites distribuidos por IP, cuenta, token, administrador y destinatario.
- Contadores atómicos en PostgreSQL, válidos con varias instancias.
- Identificadores anonimizados mediante HMAC-SHA256.
- Modo seguro: si falta la migración, las rutas sensibles no continúan.
- Límites estrictos del tamaño de cuerpos JSON.
- Rechazo de contenido distinto de JSON en las rutas que lo requieren.
- Validación de `Origin` y `Sec-Fetch-Site` para operaciones de escritura.
- Rechazo de los métodos TRACE, TRACK y CONNECT.

## Sesión, entradas y enlaces

- Comparación de CSRF en tiempo constante y formato exacto.
- Validación exacta de tokens de 256 bits.
- Validación adicional de nombres y eliminación de secciones duplicadas.
- Dirección IP validada antes de registrarla como tipo `inet`.
- Cookies con prioridad alta y borrado con los mismos atributos de seguridad.
- `APP_URL` obligatoria mediante HTTPS en producción.

## Navegador y correo

- Encabezados CSP, HSTS, CORP, COOP, Permissions-Policy y no-cache reforzados.
- Bloqueo de manejadores JavaScript en atributos mediante `script-src-attr`.
- Eliminación de `X-Powered-By`.
- SMTP con TLS 1.2 mínimo y validación obligatoria de certificado.

## Dependencias

- Versiones corregidas de `postcss` y `sharp` fijadas mediante `overrides`.
- Nodemailer se conserva en la versión 9.0.3.
- React se actualiza a 19.2.8, Vite a 8.1.5 y las herramientas de Cloudflare a
  versiones corregidas.
- `npm audit` reporta 0 vulnerabilidades en el árbol completo.

## Base de datos

- Nueva migración `202607270002_rate_limits_tym.sql`.
- Archivo acumulativo `SQL_EJECUTAR_V4_9_CORREO_Y_SEGURIDAD.sql` para quien no
  haya ejecutado el SQL de la V4.8.
