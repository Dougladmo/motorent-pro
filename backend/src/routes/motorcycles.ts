import { Router } from 'express';
import { MotorcycleController } from '../controllers/motorcycleController';
import { MotorcycleService } from '../services/motorcycleService';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';

const router = Router();

// Dependency Injection
const motorcycleRepo = new MotorcycleRepository();
const motorcycleService = new MotorcycleService(motorcycleRepo);
const controller = new MotorcycleController(motorcycleService);

// Endpoints
router.get('/', controller.getAllMotorcycles);
router.get('/:id', controller.getMotorcycleById);
router.post('/', controller.createMotorcycle);
router.patch('/:id', controller.updateMotorcycle);
router.delete('/:id', controller.deleteMotorcycle);

export default router;
