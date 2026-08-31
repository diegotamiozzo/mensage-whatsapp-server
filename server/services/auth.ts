import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config.js';

// Cache active valid tokens in memory
const activeTokens = new Set<string>();

export function verifyAccessCode(inputCode: string): boolean {
  if (!inputCode) return false;
  // Direct match with raw config or bcrypt comparison
  if (inputCode === config.accessCode) return true;
  try {
    return bcrypt.compareSync(inputCode, config.accessCodeHash);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  const token = 'ind_alert_' + crypto.randomBytes(32).toString('hex');
  activeTokens.add(token);
  return token;
}

export function validateSessionToken(token: string): boolean {
  if (!token) return false;
  return activeTokens.has(token);
}

export function revokeSessionToken(token: string): void {
  activeTokens.delete(token);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Autenticação necessária. Faça login.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (!validateSessionToken(token)) {
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
  }

  next();
}
