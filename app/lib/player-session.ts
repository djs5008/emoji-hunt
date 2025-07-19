import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getUpstashRedis } from './upstash-redis';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
const SESSION_COOKIE_NAME = 'emoji-hunt-session';

export interface PlayerSession {
  id: string;
  playerId: string;
  createdAt: number;
  lastActivity: number;
}

export class SessionManager {
  /**
   * Generate a cryptographically secure session token
   */
  static generateSessionToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generate a unique player ID
   */
  static generatePlayerId(): string {
    return `player_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Create a new session
   */
  static async createSession(): Promise<{ token: string; session: PlayerSession }> {
    const token = this.generateSessionToken();
    const playerId = this.generatePlayerId();
    const now = Date.now();

    const session: PlayerSession = {
      id: token,
      playerId,
      createdAt: now,
      lastActivity: now,
    };

    await this.saveSession(token, session);
    return { token, session };
  }

  /**
   * Save session to Redis
   */
  static async saveSession(token: string, session: PlayerSession): Promise<void> {
    const redis = getUpstashRedis();
    const key = `${SESSION_PREFIX}${token}`;
    
    await redis.setex(
      key,
      SESSION_TTL,
      JSON.stringify(session)
    );
  }

  /**
   * Get session from Redis
   */
  static async getSession(token: string): Promise<PlayerSession | null> {
    const redis = getUpstashRedis();
    const key = `${SESSION_PREFIX}${token}`;
    
    const data = await redis.get(key);
    if (!data) {
      return null;
    }

    try {
      // Redis might return the data as a string or already parsed object
      if (typeof data === 'string') {
        return JSON.parse(data) as PlayerSession;
      }
      return data as PlayerSession;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  /**
   * Validate and refresh session
   */
  static async validateSession(token: string): Promise<PlayerSession | null> {
    const session = await this.getSession(token);
    if (!session) {
      return null;
    }

    // Update last activity and refresh TTL
    session.lastActivity = Date.now();
    await this.saveSession(token, session);

    return session;
  }

  /**
   * Delete session
   */
  static async deleteSession(token: string): Promise<void> {
    const redis = getUpstashRedis();
    const key = `${SESSION_PREFIX}${token}`;
    await redis.del(key);
  }

  /**
   * Get session token from cookies
   */
  static async getSessionFromCookies(): Promise<{ token: string; session: PlayerSession } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const session = await this.validateSession(token);
    if (!session) {
      return null;
    }

    return { token, session };
  }

  /**
   * Set session cookie
   */
  static async setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL,
      path: '/',
    });
  }

  /**
   * Clear session cookie
   */
  static async clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  }

  /**
   * Get or create session
   */
  static async getOrCreateSession(): Promise<{ token: string; session: PlayerSession; isNew: boolean }> {
    // Try to get existing session
    const existing = await this.getSessionFromCookies();
    if (existing) {
      return { ...existing, isNew: false };
    }

    // Create new session
    const { token, session } = await this.createSession();
    await this.setSessionCookie(token);
    
    return { token, session, isNew: true };
  }
}