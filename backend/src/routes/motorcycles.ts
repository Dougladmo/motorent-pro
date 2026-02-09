import { Router } from 'express';
import multer from 'multer';
import { MotorcycleController } from '../controllers/motorcycleController';
import { MotorcycleService } from '../services/motorcycleService';
import { MotorcycleRepository } from '../repositories/motorcycleRepository';

const router = Router();

// Configuração do Multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, JPG, PNG ou WEBP.'));
    }
  }
});

// Dependency Injection
const motorcycleRepo = new MotorcycleRepository();
const motorcycleService = new MotorcycleService(motorcycleRepo);
const controller = new MotorcycleController(motorcycleService);

// Endpoints
router.get('/', controller.getAllMotorcycles);
router.get('/:id', controller.getMotorcycleById);
router.post('/', controller.createMotorcycle);
router.post('/with-image', upload.single('image'), controller.createMotorcycleWithImage);
router.patch('/:id', controller.updateMotorcycle);
router.patch('/:id/image', upload.single('image'), controller.updateMotorcycleWithImage);
router.delete('/:id', controller.deleteMotorcycle);

export default router;
