import { Request, Response } from 'express';
import { MotorcycleService } from '../services/motorcycleService';

export class MotorcycleController {
  constructor(private service: MotorcycleService) {}

  getAllMotorcycles = async (req: Request, res: Response): Promise<void> => {
    try {
      const motorcycles = await this.service.getAllMotorcycles();
      res.json({ success: true, data: motorcycles });
    } catch (error: any) {
      console.error('[MotorcycleController] Error fetching motorcycles:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getMotorcycleById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const motorcycle = await this.service.getMotorcycleById(id);

      if (!motorcycle) {
        res.status(404).json({ success: false, error: 'Moto não encontrada' });
        return;
      }

      res.json({ success: true, data: motorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error fetching motorcycle:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getMotorcyclesByStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query;

      if (!status || typeof status !== 'string') {
        res.status(400).json({ success: false, error: 'Status é obrigatório' });
        return;
      }

      const motorcycles = await this.service.getMotorcyclesByStatus(status);
      res.json({ success: true, data: motorcycles });
    } catch (error: any) {
      console.error('[MotorcycleController] Error fetching motorcycles by status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  createMotorcycle = async (req: Request, res: Response): Promise<void> => {
    try {
      const motorcycleData = req.body;
      const motorcycle = await this.service.createMotorcycle(motorcycleData);
      res.status(201).json({ success: true, data: motorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error creating motorcycle:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  updateMotorcycle = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const motorcycle = await this.service.updateMotorcycle(id, updates);
      res.json({ success: true, data: motorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error updating motorcycle:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  deleteMotorcycle = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteMotorcycle(id);
      res.json({ success: true, message: 'Moto deletada com sucesso' });
    } catch (error: any) {
      console.error('[MotorcycleController] Error deleting motorcycle:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
