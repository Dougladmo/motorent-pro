import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { env } from './config/env';
import { PaymentCronService } from './jobs/paymentCron';
import { PaymentRepository } from './repositories/paymentRepository';
import { RentalRepository } from './repositories/rentalRepository';
import { SubscriberRepository } from './repositories/subscriberRepository';
import { NotificationService } from './services/notificationService';
import logger from './utils/logger';

const paymentRepo = new PaymentRepository();
const rentalRepo = new RentalRepository();
const subscriberRepo = new SubscriberRepository();
const notificationService = new NotificationService();

const cronService = new PaymentCronService(
  paymentRepo,
  rentalRepo,
  subscriberRepo,
  notificationService
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
