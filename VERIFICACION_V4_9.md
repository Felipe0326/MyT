# Verificación V4.9

Fecha: 27 de julio de 2026.

## Resultados completados

- `npm test`: correcto.
- Compilación de producción Vinext/Vite: correcta.
- 8 pruebas funcionales, de seguridad y empaquetado: 8 aprobadas, 0 fallidas.
- ESLint de todos los archivos agregados o modificados en V4.9: correcto.
- `npm audit`: 0 vulnerabilidades en el árbol completo.
- `npm audit --omit=dev`: 0 vulnerabilidades de producción.
- Next.js 16.2.12, React 19.2.8, Nodemailer 9.0.3, Vite 8.1.5.

Las pruebas verifican:

- render de la entrada;
- encabezados CSP/HSTS/CORP;
- rechazo de cuerpos API sobredimensionados;
- presencia de límites, origen y lectura acotada en las rutas públicas;
- privilegios mínimos de la migración;
- TLS 1.2 y validación de certificados SMTP;
- rechazo de métodos HTTP peligrosos.
- presencia de `build/sites-vite-plugin.ts`, requerido por `vite.config.ts`.

## Pendiente en el ambiente institucional

- Ejecutar `SQL_EJECUTAR_V4_9_CORREO_Y_SEGURIDAD.sql`.
- Configurar la URL HTTPS real en `APP_URL`.
- Configurar y probar las credenciales SMTP cuando TI las entregue.
- Confirmar que el reverse proxy sustituye los encabezados de IP.

Sin las credenciales SMTP no puede realizarse una prueba real de entrega. Sin
acceso al Supabase institucional tampoco se ejecutó una prueba de integración
contra sus datos; el SQL fue revisado para ser transaccional, idempotente y no
destructivo.

## Deuda heredada que no bloquea la versión

El lint completo encuentra 46 observaciones de tipado y variables no utilizadas
en componentes heredados de Refrendos y `MotionShim`. No corresponden a los
archivos de seguridad de la V4.9 y la compilación pasa; se conservaron para no
cambiar el comportamiento de los tableros fuera del alcance de esta versión.
