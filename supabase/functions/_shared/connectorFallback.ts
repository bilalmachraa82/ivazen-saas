export type SyncType = "compras" | "vendas" | "ambos";

export type ConnectorQuery = {
  success: boolean;
  totalRecords: number;
  invoices?: unknown[];
  errorMessage?: string;
};

export type ConnectorResponse = {
  success: boolean;
  compras?: ConnectorQuery;
  vendas?: ConnectorQuery;
  timingMs?: number;
  error?: string;
};

export function isAtEmptyListMessage(
  msg: string | null | undefined,
): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("lista de faturas vazia") ||
    m.includes("lista de facturas vazia") ||
    m.includes("no invoices found") ||
    m.includes("sem faturas")
  );
}

export function isLikelyWfaUsername(value: string | null): boolean {
  if (!value) return false;
  return /^\d{9}\/\d+$/.test(value.trim());
}

function isLikelyAuthMessage(msg: string | null | undefined): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("autentic") ||
    m.includes("credencia") ||
    m.includes("não autorizado") ||
    m.includes("nao autorizado") ||
    m.includes("unauthorized") ||
    m.includes("forbidden")
  );
}

function isSchemaResponseMessage(msg: string | null | undefined): boolean {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("linesummary") ||
    m.includes("taxpayable") ||
    m.includes("taxsummary") ||
    m.includes("particle 2.1") ||
    m.includes("simple-type") ||
    m.includes("customertaxid")
  );
}

export function isConnectorAuthFailure(
  resp: ConnectorResponse,
  type: SyncType,
): boolean {
  const errors: string[] = [];
  if (resp.error) errors.push(resp.error);
  if (type === "compras" || type === "ambos") {
    if (resp.compras?.errorMessage) errors.push(resp.compras.errorMessage);
  }
  if (type === "vendas" || type === "ambos") {
    if (resp.vendas?.errorMessage) errors.push(resp.vendas.errorMessage);
  }
  return errors.some((e) => isLikelyAuthMessage(e));
}

export function isConnectorSuccessfulEmptyResponse(
  query?: ConnectorQuery,
): boolean {
  return Boolean(query?.success) && (query?.totalRecords || 0) === 0;
}

function hasVendasSchemaFailure(
  resp: ConnectorResponse,
  type: SyncType,
): boolean {
  if (type !== "vendas" && type !== "ambos") return false;
  return isSchemaResponseMessage(resp.vendas?.errorMessage) ||
    isSchemaResponseMessage(resp.error);
}

function primaryFallbackCandidate(
  resp: ConnectorResponse,
  type: SyncType,
): boolean {
  if (!resp.success) return true;
  if (isConnectorAuthFailure(resp, type)) return true;
  if (hasVendasSchemaFailure(resp, type)) return true;
  if (type === "vendas" || type === "ambos") {
    return isConnectorSuccessfulEmptyResponse(resp.vendas) ||
      isAtEmptyListMessage(resp.vendas?.errorMessage);
  }
  return false;
}

export function shouldRetryWithCredentialFallback(
  resp: ConnectorResponse,
  type: SyncType,
  primaryUsername: string | null,
  fallbackUsername: string | null,
): boolean {
  if (type !== "vendas" && type !== "ambos") return false;
  if (!isLikelyWfaUsername(fallbackUsername)) return false;
  if (isLikelyWfaUsername(primaryUsername)) return false;
  return primaryFallbackCandidate(resp, type);
}

export function shouldPreferFallbackResponse(
  primaryResp: ConnectorResponse,
  fallbackResp: ConnectorResponse,
  type: SyncType,
): boolean {
  if (!primaryFallbackCandidate(primaryResp, type)) return false;
  if (!fallbackResp.success) return false;
  if (isConnectorAuthFailure(fallbackResp, type)) return false;
  if (hasVendasSchemaFailure(fallbackResp, type)) return false;
  return true;
}
