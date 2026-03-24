-- Tabela para rastrear notificações enviadas e evitar reenvio ao reiniciar o worker
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL,
  subscriber_name text NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('payment_created', 'reminder', 'consolidated')),
  week_key text NOT NULL, -- ex: '2026-W13'
  sent_at timestamptz DEFAULT now(),
  UNIQUE(payment_id, notification_type, week_key)
);

CREATE INDEX idx_notification_log_week ON notification_log(week_key);
CREATE INDEX idx_notification_log_subscriber ON notification_log(subscriber_id, week_key);
