import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';

export class PaymentController {
  constructor(private service: PaymentService) {}

  getAllPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const payments = await this.service.getAllPayments();
      res.json({ success: true, data: payments });
    } catch (error: any) {
      console.error('[PaymentController] Error fetching payments:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getPaymentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const payment = await this.service.getPaymentById(id);

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado' });
        return;
      }

      res.json({ success: true, data: payment });
    } catch (error: any) {
      console.error('[PaymentController] Error fetching payment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getPaymentsByStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query;

      if (!status || typeof status !== 'string') {
        res.status(400).json({ success: false, error: 'Status é obrigatório' });
        return;
      }

      const payments = await this.service.getPaymentsByStatus(status);
      res.json({ success: true, data: payments });
    } catch (error: any) {
      console.error('[PaymentController] Error fetching payments by status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  markAsPaid = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { verifiedAmount } = req.body;

      const payment = await this.service.markAsPaid(id, verifiedAmount);
      res.json({ success: true, data: payment });
    } catch (error: any) {
      console.error('[PaymentController] Error marking payment as paid:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  markAsUnpaid = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body;

      const payment = await this.service.markAsUnpaid(id, reason);
      res.json({ success: true, data: payment });
    } catch (error: any) {
      console.error('[PaymentController] Error marking payment as unpaid:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  sendReminder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };

      await this.service.sendReminder(id);
      res.json({ success: true, message: 'Lembrete enviado com sucesso' });
    } catch (error: any) {
      console.error('[PaymentController] Error sending reminder:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  validateIntegrity = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.validateIntegrity();
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[PaymentController] Error validating integrity:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
