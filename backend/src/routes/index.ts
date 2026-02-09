import { Router } from 'express';
import paymentsRouter from './payments';
import motorcyclesRouter from './motorcycles';
import subscribersRouter from './subscribers';
import rentalsRouter from './rentals';

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
router.use('/motorcycles', motorcyclesRouter);
router.use('/subscribers', subscribersRouter);
router.use('/rentals', rentalsRouter);

export default router;
