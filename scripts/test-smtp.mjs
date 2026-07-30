import nodemailer from "nodemailer";

const clean = (value) => value?.trim() ?? "";
const host = clean(process.env.SMTP_HOST);
const user = clean(process.env.SMTP_USER);
const pass = clean(process.env.SMTP_PASS);
const authMethod = clean(process.env.SMTP_AUTH_METHOD).toUpperCase();
const primaryPort = Number(clean(process.env.SMTP_PORT) || "587");
const fallbackPort = Number(clean(process.env.SMTP_FALLBACK_PORT) || "465");

if (!host || !user || !pass) {
  console.error("Faltan SMTP_HOST, SMTP_USER o SMTP_PASS en .env.local.");
  process.exitCode = 1;
} else {
  const attempts = [
    { name: "587 STARTTLS", port: primaryPort, secure: false, requireTLS: true },
    { name: "465 TLS implícito", port: fallbackPort, secure: true, requireTLS: false },
  ].filter((attempt, index, list) => list.findIndex((item) => item.port === attempt.port) === index);

  let verified = false;

  for (const attempt of attempts) {
    const transporter = nodemailer.createTransport({
      host,
      port: attempt.port,
      secure: attempt.secure,
      requireTLS: attempt.requireTLS,
      auth: { user, pass },
      ...(authMethod ? { authMethod } : {}),
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 30_000,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
        servername: host,
      },
    });

    try {
      await transporter.verify();
      console.log(`Conexión SMTP correcta por ${attempt.name}.`);
      verified = true;
      break;
    } catch (error) {
      console.error(`Falló la prueba por ${attempt.name}.`, {
        code: error?.code,
        responseCode: error?.responseCode,
        response: error?.response,
        command: error?.command,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      transporter.close();
    }
  }

  if (!verified) {
    console.error("No fue posible conectar por 587 ni por 465. TI debe revisar la salida de red y las credenciales.");
    process.exitCode = 1;
  }
}
