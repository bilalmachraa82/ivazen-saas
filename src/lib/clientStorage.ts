/**
 * Client Storage Utilities
 *
 * Manages persistent storage for accountant's last selected client
 * to improve UX by remembering the active client across sessions.
 *
 * SECURITY: Only stores non-sensitive data (ID and name).
 * NIF and other PII are NOT stored in localStorage.
 */

const CLIENT_STORAGE_KEY = 'accountant-last-selected-client';
const CLIENT_NAME_STORAGE_KEY = 'accountant-last-selected-client-name';

export interface StoredClient {
  id: string;
  name: string;
  nif?: string; // Optional - NOT stored in localStorage
}

/**
 * Save the last selected client to localStorage
 * SECURITY: Only ID and name are stored. NIF is NOT persisted.
 */
export const saveLastClient = (client: StoredClient): void => {
  try {
    localStorage.setItem(CLIENT_STORAGE_KEY, client.id);
    // SECURITY: Do NOT store NIF or other sensitive PII
    localStorage.setItem(CLIENT_NAME_STORAGE_KEY, JSON.stringify({
      name: client.name,
      // NIF intentionally NOT stored for security
    }));
  } catch (error) {
    console.error('Failed to save last client');
  }
};

/**
 * Get the last selected client ID from localStorage
 */
export const getLastClientId = (): string | null => {
  try {
    return localStorage.getItem(CLIENT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get last client');
    return null;
  }
};

/**
 * Get the last selected client details from localStorage
 * Note: Returns only name, not NIF (for security)
 */
export const getLastClient = (): { name: string; nif?: string } | null => {
  try {
    const stored = localStorage.getItem(CLIENT_NAME_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to get last client details');
    return null;
  }
};

/**
 * Clear the last selected client from localStorage
 */
export const clearLastClient = (): void => {
  try {
    localStorage.removeItem(CLIENT_STORAGE_KEY);
    localStorage.removeItem(CLIENT_NAME_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear last client:', error);
  }
};

/**
 * Check if a client ID is still valid in the provided list
 */
export const isClientValid = (clientId: string, validClientIds: string[]): boolean => {
  return validClientIds.includes(clientId);
};
