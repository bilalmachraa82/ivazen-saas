import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

const SENTRY_URL_PREVIEW_LENGTH = 240;

function truncateUrl(value: string): string {
  if (value.length <= SENTRY_URL_PREVIEW_LENGTH) return value;

  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}?…`;
  } catch {
    return `${value.slice(0, SENTRY_URL_PREVIEW_LENGTH)}…`;
  }
}

// Sentry error monitoring — only active when DSN is configured
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: typeof __BUILD_COMMIT__ !== "undefined" ? __BUILD_COMMIT__ : undefined,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 50,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      const url = breadcrumb.data?.url;

      if (typeof url === "string" && url.length > SENTRY_URL_PREVIEW_LENGTH) {
        return {
          ...breadcrumb,
          data: {
            ...breadcrumb.data,
            url: truncateUrl(url),
          },
        };
      }

      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = truncateUrl(event.request.url);
      }

      return event;
    },
  });
}

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const;

const missing = REQUIRED_ENV_VARS.filter((key) => !import.meta.env[key]);

if (missing.length > 0) {
  document.getElementById("root")!.innerHTML = `
    <div style="padding:2rem;font-family:monospace;color:#dc2626;max-width:600px;margin:2rem auto">
      <h2 style="margin:0 0 1rem">IVAzen — Configuração em falta</h2>
      <p>As seguintes variáveis de ambiente são obrigatórias:</p>
      <ul>${missing.map((k) => `<li><code>${k}</code></li>`).join("")}</ul>
      <p style="color:#666;font-size:0.85rem">Verifique o ficheiro <code>.env</code> ou as variáveis de ambiente do Vercel.</p>
    </div>
  `;
  throw new Error(`Missing required env vars: ${missing.join(", ")}`);
}

createRoot(document.getElementById("root")!).render(<App />);
