# Controles de seguridad

## Identidad y sesión

- Supabase Auth valida correo y contraseña.
- Access y refresh tokens se conservan en cookies `HttpOnly`; el código del navegador no puede leerlos.
- La cookie CSRF se compara con el encabezado de cada operación que modifica datos.
- Cada sesión se registra usando el `session_id` verificado del JWT.
- Inactividad máxima: 30 minutos. Duración absoluta: 8 horas.
- Desactivar un usuario revoca todas sus sesiones registradas.

## Autorización

- Ninguna decisión de acceso depende solamente del sidebar.
- La aplicación valida el rol en el servidor.
- PostgreSQL vuelve a verificar el usuario y el permiso con RLS.
- `user_metadata` nunca se utiliza para roles o permisos.
- La llave secreta se limita a administración, invitaciones y registro de auditoría.

## Invitaciones

- Token aleatorio de 256 bits.
- Solamente se almacena SHA-256 del token.
- Vigencia de 48 horas, uso único y revocación al reenviar.
- Las contraseñas nunca se almacenan en tablas de la aplicación.

## Restablecimiento de contraseña

- Token aleatorio de 256 bits y almacenamiento exclusivo de su SHA-256.
- Vigencia de 60 minutos, uso único y revocación de enlaces anteriores después de una entrega nueva.
- La respuesta pública nunca confirma si un correo está registrado.
- Al cambiar la contraseña se revocan todas las sesiones de la aplicación.
- Ningún token de recuperación se devuelve al navegador que solicita el correo.

## Correo

- La contraseña SMTP se carga como secreto del servidor y nunca se incluye en Git o en el navegador.
- Se exige TLS 1.2 o posterior y no se desactiva la validación de certificados.
- Las fallas del proveedor no registran contraseñas, tokens ni contenido del correo.
- Los enlaces manuales de invitación solamente se muestran a administradores autenticados.

## Datos

- El navegador recibe únicamente campos necesarios y páginas de máximo 100 filas.
- Las 22 columnas del CSV NPS se conservan por requisito operativo y permanecen protegidas por RLS; el navegador solo recibe los campos necesarios para el tablero.
- La exportación neutraliza fórmulas de hojas de cálculo que comiencen con `=`, `+`, `-`, `@`, tabulador o retorno.
- Los eventos administrativos quedan registrados en `audit_logs_tym`.

## Límites y solicitudes

- Login, invitaciones y restablecimientos tienen límites compartidos entre instancias.
- Se aplican contadores independientes por IP, cuenta, token, administrador y destinatario.
- Las claves de los contadores son HMAC-SHA256; la tabla no guarda correos ni direcciones IP directamente.
- Los cuerpos JSON se leen como flujo y se cancelan al exceder el límite permitido.
- Las operaciones de escritura validan origen, tipo de contenido y CSRF cuando existe una sesión.
- El código rechaza TRACE, TRACK y CONNECT.
- Estos controles reducen fuerza bruta y abuso de aplicación; un DDoS volumétrico corresponde al WAF, reverse proxy y red de Infraestructura.

## Navegador

- CSP bloquea objetos, marcos, dominios externos y manejadores JavaScript en atributos.
- HSTS, `nosniff`, COOP, CORP, `Permissions-Policy` y `no-referrer` están activos.
- El framework todavía requiere estilos y scripts inline para el render inicial; `script-src-attr 'none'` limita la ejecución por atributos. Una futura adopción de nonces puede eliminar la excepción restante.

## Archivos y malware

- La interfaz no contiene una ruta pública para cargar archivos.
- Los CSV se preparan mediante herramientas administrativas fuera del navegador.
- Si se agrega carga de documentos, se debe incorporar validación de firma, tamaño, almacenamiento aislado y análisis antivirus.
- Antivirus/EDR del host y escaneo de imágenes de contenedor corresponden a la infraestructura.

## Operación recomendada

- Proyectos separados para desarrollo y producción.
- Rotación inmediata de cualquier secreto compartido por chat o correo.
- MFA TOTP obligatorio para administradores.
- CAPTCHA adaptativo si el monitoreo detecta automatización distribuida.
- Revisión periódica de dependencias, Auth logs y auditoría de permisos.
- Copias de seguridad y recuperación a un punto en el tiempo cuando el plan lo permita.
