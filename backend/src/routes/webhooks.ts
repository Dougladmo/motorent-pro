import { Router } from 'express';
import { handleAbacateWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/abacatepay', handleAbacateWebhook);

export default router;
