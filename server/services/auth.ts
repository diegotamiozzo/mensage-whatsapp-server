import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config.js';

interface SessionInfo {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// 24 hours token lifespan in milliseconds
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory token storage with expiration
const activeSessions = new Map<string, SessionInfo>();

// Clean expired tokens periodically (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}, 30 * 60 * 1000);

export function verifyAccessCode(inputCode: string): boolean {
  if (!inputCode || typeof inputCode !== 'string') return false;
  try {
    return bcrypt.compareSync(inputCode, config.accessCodeHash);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  const token = 'ind_alert_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  activeSessions.set(token, {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return token;
}

export function validateSessionToken(token: string): boolean {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;

  // Check TTL expiration
  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function revokeSessionToken(token: string): void {
  activeSessions.delete(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Autenticação necessária. Faça login.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (!validateSessionToken(token)) {
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  next();
}

// In-memory rate limiting for login attempts
interface RateLimitRecord {
  attempts: number;
  blockedUntil?: number;
  firstAttemptAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute window
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minute block

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (record.blockedUntil && record.blockedUntil > now) {
      const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Muitas tentativas incorretas. Tente novamente em ${waitSeconds} segundos.`,
      });
    }

    // Reset window if expired
    if (now - record.firstAttemptAt > WINDOW_MS && !record.blockedUntil) {
      loginAttempts.delete(ip);
    }
  }

  next();
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { attempts: 0, firstAttemptAt: now };
  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
  }

  loginAttempts.set(ip, record);
}

export function recordSuccessfulLogin(ip: string) {
  loginAttempts.delete(ip);
}


