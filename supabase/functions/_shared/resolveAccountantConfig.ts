interface AccountantAssociationRow {
  accountant_id: string | null;
  is_primary: boolean | null;
  created_at: string | null;
}

interface AccountantConfigRow {
  accountant_id: string;
  subuser_id: string | null;
  subuser_password_encrypted: string | null;
}

interface ResolvedAccountantConfig {
  accountantId: string | null;
  config: AccountantConfigRow | null;
  candidateIds: string[];
}

function uniqueIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const rawId of ids) {
    const id = String(rawId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

export async function resolveActiveAccountantConfig(
  supabase: any,
  clientId: string,
  preferredIds: Array<string | null | undefined>,
): Promise<ResolvedAccountantConfig> {
  const orderedIds = uniqueIds(preferredIds);

  const { data: associations, error: associationsError } = await supabase
    .from('client_accountants')
    .select('accountant_id, is_primary, created_at')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (associationsError) {
    console.warn(
      '[resolveAccountantConfig] Failed to read client_accountants:',
      associationsError.message,
    );
  }

  for (const association of (associations || []) as AccountantAssociationRow[]) {
    const accountantId = association.accountant_id?.trim();
    if (accountantId && !orderedIds.includes(accountantId)) {
      orderedIds.push(accountantId);
    }
  }

  if (orderedIds.length === 0) {
    return { accountantId: null, config: null, candidateIds: [] };
  }

  const { data: configs, error: configsError } = await supabase
    .from('accountant_at_config')
    .select('accountant_id, subuser_id, subuser_password_encrypted')
    .in('accountant_id', orderedIds)
    .eq('is_active', true);

  if (configsError) {
    console.warn(
      '[resolveAccountantConfig] Failed to read accountant_at_config:',
      configsError.message,
    );
    return {
      accountantId: orderedIds[0] || null,
      config: null,
      candidateIds: orderedIds,
    };
  }

  const configMap = new Map<string, AccountantConfigRow>();
  for (const config of (configs || []) as AccountantConfigRow[]) {
    configMap.set(config.accountant_id, config);
  }

  for (const accountantId of orderedIds) {
    const config = configMap.get(accountantId);
    if (config) {
      return {
        accountantId,
        config,
        candidateIds: orderedIds,
      };
    }
  }

  return {
    accountantId: orderedIds[0] || null,
    config: null,
    candidateIds: orderedIds,
  };
}
