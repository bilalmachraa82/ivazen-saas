import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAccessTokenOrThrow(supabase: SupabaseClient) {
  // Force auth check first. This helps catch stale local sessions.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Sessão inválida. Faça logout/login novamente.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`Falha a validar sessão: ${error.message}`);
  }

  const now = Math.floor(Date.now() / 1000) + 30;
  const isExpired = !data.session?.expires_at || data.session.expires_at <= now;

  if (isExpired) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new Error('Sessão expirada. Faça logout/login novamente.');
    }
    return refreshed.session.access_token;
  }

  if (!data.session?.access_token) {
    throw new Error('Sessão expirada. Faça logout/login novamente.');
  }

  return data.session.access_token;
}

export async function parseEdgeInvokeError(
  error: unknown,
  fallback = 'Erro ao executar Edge Function'
) {
  const err = error as {
    message?: string;
    context?: { clone?: () => Response; json?: () => Promise<unknown>; text?: () => Promise<string> };
  } | null;

  if (!err) {
    return new Error(fallback);
  }

  const ctx = err.context;
  if (ctx) {
    const responseLike = typeof ctx.clone === 'function' ? ctx.clone() : ctx;

    if (typeof responseLike.json === 'function') {
      try {
        const body = await responseLike.json() as { error?: string; message?: string } | null;
        const msg = body?.error || body?.message;
        if (msg) return new Error(String(msg));
      } catch {
        // Ignore and try text fallback.
      }
    }

    if (typeof responseLike.text === 'function') {
      try {
        const text = await responseLike.text();
        if (text) return new Error(text);
      } catch {
        // Ignore and fallback to generic message.
      }
    }
  }

  if (err.message) {
    return new Error(err.message);
  }

  return new Error(fallback);
}
