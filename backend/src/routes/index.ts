import { Router } from 'express';
import paymentsRouter from './payments';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MotoRent Pro Backend'
  });
});

// API routes
router.use('/payments', paymentsRouter);

export default router;
