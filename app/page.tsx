import { PortalApp } from "@/features/portal/components/PortalApp";

// La CSP usa un nonce distinto por petición; esta página debe renderizarse dinámicamente.
export const dynamic = "force-dynamic";

export default function Home() {
  return <PortalApp />;
}
