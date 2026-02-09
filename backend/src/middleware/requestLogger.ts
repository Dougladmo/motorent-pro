import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log da requisição recebida
  logger.info(`➡️  ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip || req.socket.remoteAddress,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent']
  });

  // Capturar a resposta
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;

    logger.info(`⬅️  ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });

    return originalSend.call(this, data);
  };

  next();
};
