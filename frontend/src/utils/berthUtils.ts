/**
 * Utility to clean legacy terminal suffixes from berth display names
 * (e.g., "Berth 05 Terminal 25541" -> "Berth 05")
 * Preserves authentic berth names while removing redundant terminal text in the UI.
 */
export const cleanBerthDisplayName = (name?: string | null): string => {
  if (!name) return '';
  return name.replace(/\s+Terminal(\s+.*)?$/i, '').trim();
};
