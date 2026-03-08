export function resolveScopedClientId(
  explicitClientId: string | null | undefined,
  fallbackUserId?: string | null,
): string | null | undefined {
  if (explicitClientId === undefined) {
    return fallbackUserId ?? undefined;
  }

  return explicitClientId;
}
