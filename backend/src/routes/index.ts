import { Router } from 'express';
import paymentsRouter from './payments';
import motorcyclesRouter from './motorcycles';
import subscribersRouter from './subscribers';
import rentalsRouter from './rentals';
import usersRouter from './users';
import { authenticateToken, requireSuperAdmin } from '../middleware/authenticateToken';

const router = Router();

// Health check (public)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MotoRent Pro Backend'
  });
});

// Protected API routes
router.use('/payments', authenticateToken, paymentsRouter);
router.use('/motorcycles', authenticateToken, motorcyclesRouter);
router.use('/subscribers', authenticateToken, subscribersRouter);
router.use('/rentals', authenticateToken, rentalsRouter);
router.use('/users', authenticateToken, requireSuperAdmin, usersRouter);

export default router;
