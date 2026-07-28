type SupabaseEnvironment = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

function required(name: string, fallbackName?: string): string {
  const value = (process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined))?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }
  return value;
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  const url = validateServerUrl(required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"), "SUPABASE_URL");
  return {
    url,
    publishableKey: required("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    secretKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getAppUrl(origin?: string): string {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    return validateServerUrl(configuredUrl, "APP_URL");
  }

  if (origin?.trim()) {
    return validateServerUrl(origin.trim(), "origen de la solicitud");
  }

  const vercelDomain =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    process.env.VERCEL_BRANCH_URL?.trim();

  if (vercelDomain) {
    const normalized = vercelDomain.startsWith("http://") || vercelDomain.startsWith("https://")
      ? vercelDomain
      : `https://${vercelDomain}`;
    return validateServerUrl(normalized, "URL de Vercel");
  }

  return validateServerUrl("http://localhost:3000", "APP_URL");
}

function validateServerUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} debe contener una URL válida.`);
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} contiene componentes no permitidos.`);
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(`${name} debe utilizar HTTPS en producción.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} debe utilizar HTTP o HTTPS.`);
  }

  return parsed.toString().replace(/\/$/, "");
}
