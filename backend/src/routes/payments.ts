import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { PaymentService } from '../services/paymentService';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';

const router = Router();

// Dependency Injection
const paymentRepo = new PaymentRepository();
const rentalRepo = new RentalRepository();
const motorcycleRepo = new MotorcycleRepository();
const subscriberRepo = new SubscriberRepository();

const paymentService = new PaymentService(
  paymentRepo,
  rentalRepo,
  motorcycleRepo,
  subscriberRepo
);
const controller = new PaymentController(paymentService);

// Endpoints
router.get('/', controller.getAllPayments);
router.get('/validate', controller.validateIntegrity);
router.get('/:id', controller.getPaymentById);
router.patch('/:id/mark-paid', controller.markAsPaid);
router.patch('/:id/mark-unpaid', controller.markAsUnpaid);
router.post('/:id/send-reminder', controller.sendReminder);

export default router;
