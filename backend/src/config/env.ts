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
}

const validateEnv = (): EnvConfig => {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FRONTEND_URL',
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
  };
};

export const env = validateEnv();
