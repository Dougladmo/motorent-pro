import { ReminderJobRepository } from '../repositories/reminderJobRepository';
import { PaymentService } from './paymentService';
import { Database } from '../models/database.types';

type ReminderJob = Database['public']['Tables']['reminder_jobs']['Row'];

export class ReminderJobService {
  constructor(
    private jobRepo: ReminderJobRepository,
    private paymentService: PaymentService
  ) {}

  async enqueue(paymentId: string): Promise<string> {
    const job = await this.jobRepo.create(paymentId);
    this.processInBackground(job.id, paymentId);
    return job.id;
  }

  private processInBackground(jobId: string, paymentId: string): void {
    setImmediate(async () => {
      try {
        await this.jobRepo.updateStatus(jobId, 'processing');
        await this.paymentService.sendReminder(paymentId);
        await this.jobRepo.updateStatus(jobId, 'completed');
      } catch (err: any) {
        const errorMessage = err?.message || 'Erro desconhecido';
        console.error(`[ReminderJobService] Job ${jobId} failed:`, err);
        await this.jobRepo.updateStatus(jobId, 'failed', errorMessage);
      }
    });
  }

  async getJobStatus(jobId: string): Promise<ReminderJob | null> {
    return this.jobRepo.findById(jobId);
  }
}
