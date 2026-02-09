import { Request, Response } from 'express';
import { RentalService } from '../services/rentalService';

export class RentalController {
  constructor(private service: RentalService) {}

  getAllRentals = async (req: Request, res: Response): Promise<void> => {
    try {
      const rentals = await this.service.getAllRentals();
      res.json({ success: true, data: rentals });
    } catch (error: any) {
      console.error('[RentalController] Error fetching rentals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getActiveRentals = async (req: Request, res: Response): Promise<void> => {
    try {
      const rentals = await this.service.getActiveRentals();
      res.json({ success: true, data: rentals });
    } catch (error: any) {
      console.error('[RentalController] Error fetching active rentals:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getRentalById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const rental = await this.service.getRentalById(id);

      if (!rental) {
        res.status(404).json({ success: false, error: 'Aluguel não encontrado' });
        return;
      }

      res.json({ success: true, data: rental });
    } catch (error: any) {
      console.error('[RentalController] Error fetching rental:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getRentalsByMotorcycleId = async (req: Request, res: Response): Promise<void> => {
    try {
      const motorcycleId = req.params.motorcycleId as string;
      const rentals = await this.service.getRentalsByMotorcycleId(motorcycleId);
      res.json({ success: true, data: rentals });
    } catch (error: any) {
      console.error('[RentalController] Error fetching rentals by motorcycle:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getRentalsBySubscriberId = async (req: Request, res: Response): Promise<void> => {
    try {
      const subscriberId = req.params.subscriberId as string;
      const rentals = await this.service.getRentalsBySubscriberId(subscriberId);
      res.json({ success: true, data: rentals });
    } catch (error: any) {
      console.error('[RentalController] Error fetching rentals by subscriber:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  createRental = async (req: Request, res: Response): Promise<void> => {
    try {
      const rentalData = req.body;
      const rental = await this.service.createRental(rentalData);
      res.status(201).json({ success: true, data: rental });
    } catch (error: any) {
      console.error('[RentalController] Error creating rental:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  updateRental = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      const rental = await this.service.updateRental(id, updates);
      res.json({ success: true, data: rental });
    } catch (error: any) {
      console.error('[RentalController] Error updating rental:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  deleteRental = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.service.deleteRental(id);
      res.json({ success: true, message: 'Aluguel deletado com sucesso' });
    } catch (error: any) {
      console.error('[RentalController] Error deleting rental:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  terminateRental = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        res.status(400).json({ success: false, error: 'Motivo da rescisão é obrigatório' });
        return;
      }

      const rental = await this.service.terminateRental(id, reason);
      res.json({
        success: true,
        message: 'Contrato rescindido com sucesso',
        data: rental
      });
    } catch (error: any) {
      console.error('[RentalController] Error terminating rental:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
