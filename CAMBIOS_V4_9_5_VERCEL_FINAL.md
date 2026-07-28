# Cambios v4.9.5 - Entrega final Vercel

- Se cambió el despliegue de vinext/Nitro a Next.js nativo para Vercel.
- `npm run dev` ahora ejecuta `next dev`.
- `npm run build` ahora ejecuta `next build` y genera `.next`.
- `npm run start` ahora ejecuta `next start`.
- `vercel.json` fuerza el preset `nextjs` y la salida `.next`.
- `APP_URL` dejó de ser obligatoria en el primer despliegue; se detecta el dominio de la petición o de Vercel.
- Se conservaron `.env.local`, el diseño, los tableros, los filtros, Supabase y n8n.
- Se agregaron encabezados de seguridad desde `next.config.ts`.
