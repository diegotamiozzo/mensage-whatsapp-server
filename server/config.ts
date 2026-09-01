import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Access code configuration
const rawAccessCode = process.env.ACCESS_CODE || 'admin123';
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && rawAccessCode === 'admin123') {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  AVISO DE SEGURANÇA: O código de acesso padrão (admin123) está sendo usado em ambiente de produção! Configure a variável ACCESS_CODE no arquivo .env.');
}

const accessCodeHash = bcrypt.hashSync(rawAccessCode, 10);

export const config = {
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  iotApiKey: process.env.IOT_API_KEY || '',
  nodeEnv: process.env.NODE_ENV || 'development',
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
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS) || 30,
  accessCode: rawAccessCode,
  accessCodeHash,
};

