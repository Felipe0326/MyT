# Cambios v4.9.1

- Se corrigió el warning de React causado por `whileInView` llegando al DOM desde `MotionShim`.
- La comprobación inicial de sesión sin usuario ahora responde como estado normal (`authenticated: false`) y evita el 401 rojo en consola.
- Se mantiene el 401 en las rutas realmente protegidas cuando corresponde.
- Se añadió `credentials: same-origin` de forma explícita al consultar la sesión.
- El mensaje `Port disconnected from addon code` pertenece a una extensión del navegador y no al sistema.
