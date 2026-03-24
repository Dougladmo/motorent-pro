-- Adiciona flag para ativar/desativar envio automático de lembretes por assinante
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS auto_reminders_enabled boolean NOT NULL DEFAULT true;
