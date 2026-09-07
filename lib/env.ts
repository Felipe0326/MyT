import "server-only";

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
  const url = validateServerUrl(required("SUPABASE_URL"), "SUPABASE_URL");
  return {
    url,
    publishableKey: required("SUPABASE_ANON_KEY"),
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

  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta la variable de entorno APP_URL en producción.");
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
  const isLoopback =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";
  if (
    process.env.NODE_ENV === "production" &&
    parsed.protocol !== "https:" &&
    !isLoopback
  ) {
    throw new Error(`${name} debe utilizar HTTPS en producción.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} debe utilizar HTTP o HTTPS.`);
  }

  return parsed.toString().replace(/\/$/, "");
}
