import { Router } from 'express';
import multer from 'multer';
import { SubscriberController } from '../controllers/subscriberController';
import { SubscriberService } from '../services/subscriberService';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { SubscriberDocumentController } from '../controllers/subscriberDocumentController';
import { SubscriberDocumentService } from '../services/subscriberDocumentService';
import { SubscriberDocumentRepository } from '../repositories/subscriberDocumentRepository';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Dependency Injection
const subscriberRepo = new SubscriberRepository();
const subscriberService = new SubscriberService(subscriberRepo);
const controller = new SubscriberController(subscriberService);

const documentRepo = new SubscriberDocumentRepository();
const documentService = new SubscriberDocumentService(documentRepo);
const documentController = new SubscriberDocumentController(documentService);

// Subscriber endpoints
router.get('/', controller.getAllSubscribers);
router.get('/active', controller.getActiveSubscribers);
router.get('/:id', controller.getSubscriberById);
router.post('/', controller.createSubscriber);
router.patch('/:id', controller.updateSubscriber);
router.delete('/:id', controller.deleteSubscriber);

// Document endpoints
router.get('/:id/documents', documentController.getDocuments);
router.post('/:id/documents', upload.single('file'), documentController.uploadDocument);
router.get('/:id/documents/:docId/signed-url', documentController.getSignedUrl);
router.delete('/:id/documents/:docId', documentController.deleteDocument);

export default router;
