/**
 * Player Storage Utilities
 * 
 * @description Manages player identification across browser sessions using
 * both localStorage and cookies. This dual-storage approach ensures:
 * - Persistence across sessions (localStorage)
 * - Server-side access via middleware (cookies)
 * 
 * The player ID is crucial for:
 * - Maintaining player identity across page refreshes
 * - Rejoining lobbies after disconnection
 * - Authorization for host-only actions
 */

/**
 * Stores player ID in both localStorage and cookies
 * 
 * @description Persists the player ID in two storage mechanisms to ensure
 * it's available both client-side and server-side. The 30-day expiry
 * allows players to maintain their identity for a reasonable period.
 * 
 * @param {string} playerId - Unique player identifier (nanoid)
 * 
 * Cookie attributes:
 * - path=/: Available throughout the site
 * - expires: 30 days from now
 * - SameSite=Strict: CSRF protection
 */
export function setPlayerId(playerId: string) {
  // Store in localStorage for client-side access
  localStorage.setItem('playerId', playerId);
  
  // Also store in cookie for middleware access
  // Set cookie with 30 day expiry
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `playerId=${playerId}; path=/; expires=${expires.toUTCString()}; SameSite=Strict`;
}

/**
 * Retrieves player ID from localStorage
 * 
 * @description Gets the stored player ID for client-side use.
 * Note: This only checks localStorage, not cookies.
 * 
 * @returns {string | null} Player ID if exists, null otherwise
 */
export function getPlayerId(): string | null {
  return localStorage.getItem('playerId');
}

/**
 * Removes player ID from all storage
 * 
 * @description Clears the player ID from both localStorage and cookies.
 * Used when a player wants to start fresh or during logout scenarios.
 * 
 * Cookie removal technique:
 * - Sets expiry to Unix epoch (Jan 1, 1970)
 * - Browser automatically deletes expired cookies
 */
export function clearPlayerId() {
  localStorage.removeItem('playerId');
  // Clear cookie by setting expiry in the past
  document.cookie = 'playerId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict';
}