import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NODE_ENV: string;
  CRON_PAYMENT_GENERATION: string;
  WORKER_PORT: number;
  EVOLUTION_API_URL: string;
  EVOLUTION_API_KEY: string;
  EVOLUTION_INSTANCE: string;
  PIX_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  REMINDER_DAYS_BEFORE: number;
}

const validateEnv = (): EnvConfig => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE',
    'PIX_KEY',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    NODE_ENV: process.env.NODE_ENV || 'development',
    CRON_PAYMENT_GENERATION: process.env.CRON_PAYMENT_GENERATION || '0 */6 * * *',
    WORKER_PORT: parseInt(process.env.WORKER_PORT || '3002'),
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL!,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY!,
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE!,
    PIX_KEY: process.env.PIX_KEY!,
    RESEND_API_KEY: process.env.RESEND_API_KEY!,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL!,
    REMINDER_DAYS_BEFORE: parseInt(process.env.REMINDER_DAYS_BEFORE || '1'),
  };
};

export const env = validateEnv();
