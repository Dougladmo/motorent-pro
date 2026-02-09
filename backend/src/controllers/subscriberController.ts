import { Request, Response } from 'express';
import { SubscriberService } from '../services/subscriberService';

export class SubscriberController {
  constructor(private service: SubscriberService) {}

  getAllSubscribers = async (req: Request, res: Response): Promise<void> => {
    try {
      const subscribers = await this.service.getAllSubscribers();
      res.json({ success: true, data: subscribers });
    } catch (error: any) {
      console.error('[SubscriberController] Error fetching subscribers:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getActiveSubscribers = async (req: Request, res: Response): Promise<void> => {
    try {
      const subscribers = await this.service.getActiveSubscribers();
      res.json({ success: true, data: subscribers });
    } catch (error: any) {
      console.error('[SubscriberController] Error fetching active subscribers:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getSubscriberById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const subscriber = await this.service.getSubscriberById(id);

      if (!subscriber) {
        res.status(404).json({ success: false, error: 'Assinante não encontrado' });
        return;
      }

      res.json({ success: true, data: subscriber });
    } catch (error: any) {
      console.error('[SubscriberController] Error fetching subscriber:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  createSubscriber = async (req: Request, res: Response): Promise<void> => {
    try {
      const subscriberData = req.body;
      const subscriber = await this.service.createSubscriber(subscriberData);
      res.status(201).json({ success: true, data: subscriber });
    } catch (error: any) {
      console.error('[SubscriberController] Error creating subscriber:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  updateSubscriber = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const subscriber = await this.service.updateSubscriber(id, updates);
      res.json({ success: true, data: subscriber });
    } catch (error: any) {
      console.error('[SubscriberController] Error updating subscriber:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  deleteSubscriber = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteSubscriber(id);
      res.json({ success: true, message: 'Assinante deletado com sucesso' });
    } catch (error: any) {
      console.error('[SubscriberController] Error deleting subscriber:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
