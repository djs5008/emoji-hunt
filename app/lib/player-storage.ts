// Utility functions to manage player ID in both localStorage and cookies

export function setPlayerId(playerId: string) {
  // Store in localStorage
  localStorage.setItem('playerId', playerId);
  
  // Also store in cookie for middleware access
  // Set cookie with 30 day expiry
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  document.cookie = `playerId=${playerId}; path=/; expires=${expires.toUTCString()}; SameSite=Strict`;
}

export function getPlayerId(): string | null {
  return localStorage.getItem('playerId');
}

export function clearPlayerId() {
  localStorage.removeItem('playerId');
  // Clear cookie by setting expiry in the past
  document.cookie = 'playerId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict';
}