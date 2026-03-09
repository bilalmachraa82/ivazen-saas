import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// lovable-tagger removed — no longer on Lovable platform
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

function getBuildCommit(): string {
  // Prefer CI-provided commit SHAs when available.
  const envCommit =
    process.env.VITE_BUILD_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NETLIFY_COMMIT_REF ||
    process.env.GITHUB_SHA;
  if (envCommit) return envCommit.slice(0, 7);

  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// Extract the hostname from the Supabase URL for workbox runtime caching patterns.
// Falls back to the current project ID if the env var is not set at build time.
const supabaseHost = (() => {
  const url = process.env.VITE_SUPABASE_URL;
  if (url) {
    try { return new URL(url).host; } catch { /* fall through */ }
  }
  return 'dmprkdvkzzjtixlatnlx.supabase.co';
})();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildCommit = getBuildCommit();
  const buildTimeIso = new Date().toISOString();

  return {
    server: {
      host: "::",
      port: 8080,
    },
    define: {
      __BUILD_COMMIT__: JSON.stringify(buildCommit),
      __BUILD_TIME_ISO__: JSON.stringify(buildTimeIso),
    },
    plugins: [
      react(),
      // componentTagger removed — no longer on Lovable platform
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "icon-192.png", "icon-512.png", "robots.txt"],
        manifest: false,
        workbox: {
          // Ensure new deployments update aggressively even with SW caching.
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: new RegExp(`^https://${supabaseHost.replace(/\./g, '\\.')}/rest/.*`, 'i'),
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api",
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: new RegExp(`^https://${supabaseHost.replace(/\./g, '\\.')}/storage/.*`, 'i'),
              handler: "CacheFirst",
              options: {
                cacheName: "supabase-storage",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-stylesheets",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-webfonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ].filter(Boolean),
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // ── Heavy export libraries (already partially separated, now explicit) ──
            if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
            if (id.includes('node_modules/jspdf')) return 'vendor-pdf';
            if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas';
            if (id.includes('node_modules/dompurify') || id.includes('node_modules/isomorphic-dompurify')) return 'vendor-dompurify';

            // ── Crypto (node-forge) — only used by AdminCertificates ──
            if (id.includes('node_modules/node-forge')) return 'vendor-crypto';

            // Recharts/d3 stay with Vite's default chunking. A dedicated charts
            // chunk caused a production-time initialization error on first load.

            // ── React core ──
            if (
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/scheduler')
            ) return 'vendor-react';

            // ── Routing ──
            if (id.includes('node_modules/react-router')) return 'vendor-router';

            // ── Server state ──
            if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query';

            // ── Supabase client ──
            if (id.includes('node_modules/@supabase')) return 'vendor-supabase';

            // ── Radix UI primitives ──
            if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';

            // ── Icons ──
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';

            // ── Forms ──
            if (
              id.includes('node_modules/react-hook-form') ||
              id.includes('node_modules/@hookform') ||
              id.includes('node_modules/zod')
            ) return 'vendor-form';

            // ── Date utilities ──
            if (id.includes('node_modules/date-fns')) return 'vendor-date';
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
