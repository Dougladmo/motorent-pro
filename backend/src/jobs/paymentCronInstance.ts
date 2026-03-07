import { PaymentCronService } from './paymentCron';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';
import { NotificationService } from '../services/notificationService';

// Singleton instances
let cronServiceInstance: PaymentCronService | null = null;
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}

export function getPaymentCronService(): PaymentCronService {
  if (!cronServiceInstance) {
    const paymentRepo = new PaymentRepository();
    const rentalRepo = new RentalRepository();
    const subscriberRepo = new SubscriberRepository();

    cronServiceInstance = new PaymentCronService(
      paymentRepo,
      rentalRepo,
      subscriberRepo,
      getNotificationService()
    );
  }

  return cronServiceInstance;
}
