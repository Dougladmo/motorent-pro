import { Router } from 'express';
import { RentalController } from '../controllers/rentalController';
import { RentalService } from '../services/rentalService';
import { RentalRepository } from '../repositories/rentalRepository';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { PaymentRepository } from '../repositories/paymentRepository';

const router = Router();

// Dependency Injection
const rentalRepo = new RentalRepository();
const motorcycleRepo = new MotorcycleRepository();
const subscriberRepo = new SubscriberRepository();
const paymentRepo = new PaymentRepository();

const rentalService = new RentalService(rentalRepo, motorcycleRepo, subscriberRepo, paymentRepo);

const controller = new RentalController(rentalService);

// Endpoints
router.get('/', controller.getAllRentals);
router.get('/active', controller.getActiveRentals);
router.get('/:id', controller.getRentalById);
router.get('/motorcycle/:motorcycleId', controller.getRentalsByMotorcycleId);
router.get('/subscriber/:subscriberId', controller.getRentalsBySubscriberId);
router.post('/', controller.createRental);
router.post('/:id/terminate', controller.terminateRental);
router.patch('/:id', controller.updateRental);
router.delete('/:id', controller.deleteRental);

export default router;
