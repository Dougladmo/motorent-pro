import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PORT: number;
  NODE_ENV: string;
  CRON_PAYMENT_GENERATION: string;
  FRONTEND_URL: string;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  EVOLUTION_INSTANCE: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  WORKER_URL: string;
}

const validateEnv = (): EnvConfig => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FRONTEND_URL',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    PORT: parseInt(process.env.PORT || '3001'),
    NODE_ENV: process.env.NODE_ENV || 'development',
    CRON_PAYMENT_GENERATION: process.env.CRON_PAYMENT_GENERATION || '0 */6 * * *',
    FRONTEND_URL: process.env.FRONTEND_URL!,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL!,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY!,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL!,
    WORKER_URL: process.env.WORKER_URL || 'http://localhost:3002',
  };
};

export const env = validateEnv();
