import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Default access code hash: default is "admin123"
const rawAccessCode = process.env.ACCESS_CODE || 'admin123';
const accessCodeHash = bcrypt.hashSync(rawAccessCode, 10);

export const config = {
  port: 3000,
  db: {
    host: process.env.DATABASE_HOST || '',
    port: Number(process.env.DATABASE_PORT) || 3306,
    name: process.env.DATABASE_NAME || 'industrial_alerts',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    url: process.env.DATABASE_URL || '',
  },
  whatsappSessionPath: process.env.WHATSAPP_SESSION_PATH || './auth_info_baileys',
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL) || 2000,
  maxRetryAttempts: Number(process.env.MAX_RETRY_ATTEMPTS) || 5,
  throttleWindowMinutes: Number(process.env.THROTTLE_WINDOW_MINUTES) || 10,
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS) || 30,
  accessCode: rawAccessCode,
  accessCodeHash,
  jwtSecret: process.env.JWT_SECRET || 'industrial-alerts-secret-token-key',
};
