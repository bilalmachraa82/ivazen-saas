const env = import.meta.env as Record<string, string | undefined>;

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value === '') return defaultValue;
  const normalized = value.toLowerCase().trim();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export const featureFlags = {
  atControlCenterV1: parseBool(env.VITE_AT_CONTROL_CENTER_V1, true),
};
