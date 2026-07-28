# V4.9.2 — Recuperación ante cortes de conexión

- Corrige el mensaje engañoso que afirmaba que el SQL 4.9 no estaba instalado cuando en realidad Supabase no respondía.
- Reintenta hasta tres veces las funciones RPC del control de intentos ante errores transitorios de red o respuestas 408/429/5xx.
- Mantiene el comportamiento seguro: si después de los reintentos Supabase sigue sin responder, el inicio de sesión se bloquea temporalmente con HTTP 503.
- Registra en la terminal del servidor el nombre de la función RPC y el error real para facilitar el diagnóstico.
- No modifica tablas, SQL, n8n, credenciales ni datos.
