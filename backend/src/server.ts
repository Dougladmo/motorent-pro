import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { env } from './config/env';
import { getPaymentCronService } from './jobs/paymentCronInstance';
import logger from './utils/logger';

const PORT = env.PORT;

// Inicializar servidor
const server = app.listen(PORT, () => {
  logger.info(`[SERVER] Backend rodando na porta ${PORT}`);
  logger.info(`[SERVER] Ambiente: ${env.NODE_ENV}`);
  logger.info(`[SERVER] Frontend URL: ${env.FRONTEND_URL}`);

  // Iniciar CRON jobs
  const paymentCronService = getPaymentCronService();
  paymentCronService.startCronJobs();

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
