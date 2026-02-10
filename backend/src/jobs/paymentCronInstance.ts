import { PaymentCronService } from './paymentCron';
import { PaymentRepository } from '../repositories/paymentRepository';
import { RentalRepository } from '../repositories/rentalRepository';
import { SubscriberRepository } from '../repositories/subscriberRepository';

// Singleton instance
let cronServiceInstance: PaymentCronService | null = null;

export function getPaymentCronService(): PaymentCronService {
  if (!cronServiceInstance) {
    const paymentRepo = new PaymentRepository();
    const rentalRepo = new RentalRepository();
    const subscriberRepo = new SubscriberRepository();

    cronServiceInstance = new PaymentCronService(paymentRepo, rentalRepo, subscriberRepo);
  }

  return cronServiceInstance;
}
