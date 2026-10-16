import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const isVercel = Boolean(process.env.VERCEL);
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : (isVercel ? '/tmp/uploads' : path.resolve(__dirname, '../../..', 'uploads'));

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn('[Env] Could not create upload directory:', err);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_DEFAULT_MODEL || 'openrouter/free',
  databaseUrl: process.env.DATABASE_URL || '',
  databasePath: path.resolve(__dirname, '../../..', process.env.DATABASE_PATH || './data/split_ledger.sqlite'),
  uploadDir,
  nodeEnv: process.env.NODE_ENV || 'development',
  maxFileSize: 50 * 1024 * 1024 // 50MB
};
