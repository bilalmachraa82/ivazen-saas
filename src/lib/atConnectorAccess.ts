interface ATCredentialLike {
  subuser_id?: string | null;
  encrypted_username?: string | null;
  portal_nif?: string | null;
  encrypted_password?: string | null;
  portal_password_encrypted?: string | null;
  environment?: string | null;
}

interface AccountantATConfigLike {
  is_active?: boolean | null;
  subuser_id?: string | null;
  subuser_password_encrypted?: string | null;
  environment?: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value || '').trim());
}

export function hasUsableClientATCredentials(
  credential: ATCredentialLike | null | undefined,
  clientNif?: string | null,
): boolean {
  if (!credential) return false;

  const hasUsername =
    hasText(credential.subuser_id) ||
    hasText(credential.encrypted_username) ||
    hasText(credential.portal_nif) ||
    hasText(clientNif);

  const hasPassword =
    hasText(credential.encrypted_password) ||
    hasText(credential.portal_password_encrypted);

  return hasUsername && hasPassword;
}

export function hasUsableSharedATConnector(
  config: AccountantATConfigLike | null | undefined,
): boolean {
  if (!config?.is_active) return false;

  return hasText(config.subuser_id) && hasText(config.subuser_password_encrypted);
}

export function hasAnyUsableATConnectorAccess(params: {
  credential?: ATCredentialLike | null;
  sharedConfig?: AccountantATConfigLike | null;
  clientNif?: string | null;
}): boolean {
  return (
    hasUsableClientATCredentials(params.credential, params.clientNif) ||
    hasUsableSharedATConnector(params.sharedConfig)
  );
}

export function resolveATEnvironment(params: {
  credential?: ATCredentialLike | null;
  sharedConfig?: AccountantATConfigLike | null;
  fallback?: string | null;
}): string | null {
  const credentialEnvironment = params.credential?.environment?.trim();
  if (credentialEnvironment) return credentialEnvironment;

  const sharedEnvironment = params.sharedConfig?.environment?.trim();
  if (sharedEnvironment) return sharedEnvironment;

  return params.fallback ?? null;
}
