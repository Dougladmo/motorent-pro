import { Router } from 'express';
import { SubscriberController } from '../controllers/subscriberController';
import { SubscriberService } from '../services/subscriberService';
import { SubscriberRepository } from '../repositories/subscriberRepository';

const router = Router();

// Dependency Injection
const subscriberRepo = new SubscriberRepository();
const subscriberService = new SubscriberService(subscriberRepo);
const controller = new SubscriberController(subscriberService);

// Endpoints
router.get('/', controller.getAllSubscribers);
router.get('/active', controller.getActiveSubscribers);
router.get('/:id', controller.getSubscriberById);
router.post('/', controller.createSubscriber);
router.patch('/:id', controller.updateSubscriber);
router.delete('/:id', controller.deleteSubscriber);

export default router;
