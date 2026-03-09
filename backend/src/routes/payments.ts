import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { PaymentService } from '../services/paymentService';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';

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
  subscriberRepo,
  new NotificationService()
);
const controller = new PaymentController(paymentService);

// Endpoints
router.get('/', controller.getAllPayments);
router.get('/validate', controller.validateIntegrity);
router.get('/:id', controller.getPaymentById);
router.patch('/:id/mark-paid', controller.markAsPaid);
router.patch('/:id/mark-unpaid', controller.markAsUnpaid);
router.patch('/:id', controller.updatePayment);
router.post('/:id/send-reminder', controller.sendReminder);
router.delete('/:id', controller.deletePayment);

export default router;
