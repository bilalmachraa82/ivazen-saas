export interface WindowCheckResult {
  isWithin: boolean;
  message: string;
  nextWindowStart?: string;
  nextWindowEnd?: string;
}

interface ValidateSyncEfaturaRequestInput {
  clientId?: string;
  environment?: string;
  source: "queue" | "manual";
  forceSync: boolean;
  isServiceRole: boolean;
  windowCheck: WindowCheckResult;
}

interface ValidationResponse {
  status: number;
  body: Record<string, unknown>;
}

export function validateSyncEfaturaRequest(
  input: ValidateSyncEfaturaRequestInput,
): ValidationResponse | null {
  if (!input.clientId) {
    return {
      status: 400,
      body: { error: "clientId is required" },
    };
  }

  if (
    input.source !== "queue" &&
    input.environment !== "test" &&
    !input.windowCheck.isWithin &&
    !(input.forceSync && input.isServiceRole)
  ) {
    return {
      status: 200,
      body: {
        success: false,
        reasonCode: "AT_TIME_WINDOW",
        error: input.windowCheck.message,
        nextWindowStart: input.windowCheck.nextWindowStart,
        nextWindowEnd: input.windowCheck.nextWindowEnd,
      },
    };
  }

  return null;
}
