import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { env } from './config/env';
import { PaymentCronService } from './jobs/paymentCron';
import { PaymentRepository } from './repositories/paymentRepository';
import { RentalRepository } from './repositories/rentalRepository';
import { SubscriberRepository } from './repositories/subscriberRepository';
import logger from './utils/logger';

const PORT = env.PORT;

// Inicializar servidor
const server = app.listen(PORT, () => {
  logger.info(`[SERVER] Backend rodando na porta ${PORT}`);
  logger.info(`[SERVER] Ambiente: ${env.NODE_ENV}`);
  logger.info(`[SERVER] Frontend URL: ${env.FRONTEND_URL}`);

  // Inicializar CRON
  const paymentRepo = new PaymentRepository();
  const rentalRepo = new RentalRepository();
  const subscriberRepo = new SubscriberRepository();

  const cronService = new PaymentCronService(paymentRepo, rentalRepo, subscriberRepo);
  cronService.startCronJobs();

  logger.info('[SERVER] CRON jobs iniciados');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[SERVER] SIGTERM received, closing server gracefully');
  server.close(() => {
    logger.info('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('[SERVER] SIGINT received, closing server gracefully');
  server.close(() => {
    logger.info('[SERVER] Server closed');
    process.exit(0);
  });
});

export default server;
