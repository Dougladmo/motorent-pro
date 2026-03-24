import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { env } from './config/env';
import { PaymentCronService } from './jobs/paymentCron';
import { PaymentRepository } from './repositories/paymentRepository';
import { RentalRepository } from './repositories/rentalRepository';
import { SubscriberRepository } from './repositories/subscriberRepository';
import { NotificationService } from './services/notificationService';
import { NotificationLogRepository } from './repositories/notificationLogRepository';
import logger from './utils/logger';

const paymentRepo = new PaymentRepository();
const rentalRepo = new RentalRepository();
const subscriberRepo = new SubscriberRepository();
const notificationService = new NotificationService();
const notificationLog = new NotificationLogRepository();

const cronService = new PaymentCronService(
  paymentRepo,
  rentalRepo,
  subscriberRepo,
  notificationService,
  notificationLog
);

// Iniciar cron
cronService.startCronJobs();
logger.info('[WORKER] Cron iniciado');

// Servidor HTTP mínimo para trigger manual ao criar novo contrato
const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/trigger/rental/')) {
    const rentalId = req.url.split('/trigger/rental/')[1];

    if (!rentalId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'rentalId obrigatório' }));
      return;
    }

    try {
      const count = await cronService.generatePaymentsForRental(rentalId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, paymentsCreated: count }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('[WORKER] Erro ao gerar pagamentos via trigger:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: message }));
    }
    return;
  }

  // GET /notifications/week - lista quem já foi notificado na semana atual
  if (req.method === 'GET' && req.url?.startsWith('/notifications/week')) {
    try {
      const url = new URL(req.url, `http://localhost:${env.WORKER_PORT}`);
      const weekKey = url.searchParams.get('week') ?? undefined;
      const logs = await notificationLog.findByWeek(weekKey);

      // Agrupar por assinante
      const bySubscriber = new Map<string, { name: string; notifications: typeof logs }>();
      for (const log of logs) {
        if (!bySubscriber.has(log.subscriber_id)) {
          bySubscriber.set(log.subscriber_id, { name: log.subscriber_name, notifications: [] });
        }
        bySubscriber.get(log.subscriber_id)!.notifications.push(log);
      }

      const result = {
        week: weekKey ?? notificationLog.getWeekKey(),
        total: logs.length,
        subscribers: Array.from(bySubscriber.entries()).map(([id, data]) => ({
          subscriber_id: id,
          subscriber_name: data.name,
          notifications: data.notifications.map(n => ({
            payment_id: n.payment_id,
            type: n.notification_type,
            sent_at: n.sent_at
          }))
        }))
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: result }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('[WORKER] Erro ao buscar notification logs:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/trigger/run') {
    try {
      await cronService.runPaymentGeneration();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('[WORKER] Erro ao rodar payment generation:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Not found' }));
});

server.listen(env.WORKER_PORT, () => {
  logger.info(`[WORKER] Servidor HTTP escutando na porta ${env.WORKER_PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('[WORKER] SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('[WORKER] SIGINT received, shutting down');
  server.close(() => process.exit(0));
});
