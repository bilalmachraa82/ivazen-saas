/**
 * AT Time Window — shared frontend utility
 *
 * Handles the AT_TIME_WINDOW reason code from sync-efatura responses.
 * Used by all manual sync entrypoints (EFaturaAPIConfig, useATCredentials, ReconciliationAudit).
 */

import { toast } from "sonner";

interface SyncResponse {
  success: boolean;
  reasonCode?: string;
  error?: string;
  nextWindowStart?: string;
  nextWindowEnd?: string;
  [key: string]: unknown;
}

/**
 * Check if a sync-efatura response indicates an AT time window block.
 * If so, shows a user-friendly toast and returns true (caller should abort).
 */
export function handleATTimeWindowResponse(response: SyncResponse | null | undefined): boolean {
  if (!response || response.reasonCode !== "AT_TIME_WINDOW") return false;

  const nextStart = response.nextWindowStart || "??:??";
  const nextEnd = response.nextWindowEnd || "??:??";

  toast.warning("Fora do horário AT", {
    description: `A sincronização com a AT só está disponível entre as ${nextStart} e ${nextEnd} (hora de Lisboa). Tente novamente dentro dessa janela.`,
    duration: 10000,
  });

  return true;
}

/**
 * Returns Portuguese-friendly text for AT sync reason codes.
 * Used for displaying sync history status.
 */
export function getReasonCodeLabel(reasonCode: string | null | undefined): string {
  switch (reasonCode) {
    case "AT_TIME_WINDOW":
      return "Fora do horário AT";
    case "AT_AUTH_FAILED":
      return "Falha de autenticação";
    case "AT_EMPTY_LIST":
      return "Sem faturas no período";
    case "AT_YEAR_UNAVAILABLE":
      return "Ano não disponível";
    case "AT_STARTDATE_FUTURE":
      return "Data de início futura";
    case "INVALID_CLIENT_NIF":
      return "NIF inválido";
    case "YEAR_IN_FUTURE":
      return "Ano fiscal futuro";
    case "AT_SCHEMA_RESPONSE_ERROR":
      return "Erro de formato AT";
    case "UNKNOWN_AT_ERROR":
      return "Erro desconhecido";
    default:
      return reasonCode || "Desconhecido";
  }
}
