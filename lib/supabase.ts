import { getSupabaseEnvironment } from "./env";

type FetchOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string;
  serviceRole?: boolean;
  headers?: Record<string, string>;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

export async function supabaseFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const env = getSupabaseEnvironment();
  const apiKey = options.serviceRole ? env.secretKey : env.publishableKey;
  const authorization = options.accessToken
    ? `Bearer ${options.accessToken}`
    : options.serviceRole
      ? `Bearer ${env.secretKey}`
      : `Bearer ${env.publishableKey}`;

  return fetch(`${env.url}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
}

export async function signInWithPassword(email: string, password: string): Promise<AuthTokens> {
  const response = await supabaseFetch("/auth/v1/token?grant_type=password", {
    body: { email, password },
  });
  if (!response.ok) throw new Error("Credenciales incorrectas o cuenta no disponible.");
  return response.json() as Promise<AuthTokens>;
}

export async function refreshAuthToken(refreshToken: string): Promise<AuthTokens> {
  const response = await supabaseFetch("/auth/v1/token?grant_type=refresh_token", {
    body: { refresh_token: refreshToken },
  });
  if (!response.ok) throw new Error("La sesión ya no es válida.");
  return response.json() as Promise<AuthTokens>;
}

export async function getVerifiedAuthUser(accessToken: string): Promise<AuthTokens["user"] | null> {
  const response = await supabaseFetch("/auth/v1/user", { accessToken });
  if (!response.ok) return null;
  return response.json() as Promise<AuthTokens["user"]>;
}

export type AdminAuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

export async function adminFindUserByEmail(email: string): Promise<AdminAuthUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const response = await supabaseFetch(
      `/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { serviceRole: true },
    );

    if (!response.ok) {
      throw new Error("No fue posible verificar la cuenta en Supabase Auth.");
    }

    const payload = (await response.json()) as
      | { users?: AdminAuthUser[] }
      | AdminAuthUser[];
    const users = Array.isArray(payload) ? payload : (payload.users ?? []);
    const existingUser = users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (existingUser) return existingUser;
    if (users.length < perPage) return null;
  }

  throw new Error("No fue posible completar la búsqueda del usuario en Supabase Auth.");
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ id: string; email?: string }> {
  const response = await supabaseFetch("/auth/v1/admin/users", {
    serviceRole: true,
    body: {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
      app_metadata: { system_code: "tym" },
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    if (/already|registered|exists/i.test(detail)) {
      throw new Error("Ya existe una cuenta con ese correo.");
    }
    throw new Error("No fue posible crear la cuenta en Supabase Auth.");
  }
  return response.json() as Promise<{ id: string; email?: string }>;
}

export async function adminUpdateUserPassword(userId: string, password: string): Promise<void> {
  const response = await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    serviceRole: true,
    body: { password },
  });
  if (!response.ok) {
    throw new Error("No fue posible actualizar la contraseña en Supabase Auth.");
  }
}

export async function serviceRest(path: string, options: Omit<FetchOptions, "serviceRole"> = {}) {
  return supabaseFetch(`/rest/v1/${path}`, { ...options, serviceRole: true });
}

export async function userRest(path: string, accessToken: string, options: FetchOptions = {}) {
  return supabaseFetch(`/rest/v1/${path}`, { ...options, accessToken });
}

export async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
