# Sistema de Movilidad y Transporte (TYM)

**Versión de la aplicación:** `1.0.0`

## Versiones

| Tecnología | Versión |
|---|---|
| Node.js | `>=20.9.0 <25` |
| Node.js recomendado | `22 LTS` |
| npm | `11.12.1` |
| Next.js | `^16.2.12` |
| React | `19.2.8` |
| React DOM | `19.2.8` |
| TypeScript | `5.9.3` |
| Tailwind CSS | `4.2.1` |
| Recharts | `^3.10.0` |
| Lucide React | `^1.25.0` |
| Zod | `^4.4.3` |
| Nodemailer | `^9.0.3` |
| ESLint | `10.8.0` |

## Puertos requeridos

| Servicio | Puerto | Uso |
|---|---:|---|
| Aplicación Next.js | `3000/TCP` | Servicio web |
| Supabase y n8n | `443/TCP` | Conexiones HTTPS |
| SMTP principal | `587/TCP` | STARTTLS |
| SMTP alternativo | `465/TCP` | TLS |

## Variables de `.env.local`

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

APP_URL=

RATE_LIMIT_SECRET=

SMTP_HOST=
SMTP_PORT=587
SMTP_FALLBACK_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_AUTH_METHOD=LOGIN
SMTP_BOUNCE_TO=
EMAIL_FROM=
EMAIL_REPLY_TO=

RESEND_API_KEY=

N8N_LICENCIAS_WEBHOOK_URL=
N8N_REFRENDOS_WEBHOOK_URL=
N8N_NPS_WEBHOOK_URL=
N8N_WEBHOOK_ALLOWED_HOSTS=
N8N_WEBHOOK_AUTH_REQUIRED=true
N8N_LICENCIAS_WEBHOOK_SECRET=
N8N_REFRENDOS_WEBHOOK_SECRET=
N8N_NPS_WEBHOOK_SECRET=
N8N_WEBHOOK_SECRET=