import { Request, Response } from 'express';
import { MotorcycleService } from '../services/motorcycleService';
import { UploadService } from '../services/uploadService';

export class MotorcycleController {
  private uploadService: UploadService;

  constructor(private service: MotorcycleService) {
    this.uploadService = new UploadService();
  }

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

  createMotorcycleWithImage = async (req: Request, res: Response): Promise<void> => {
    try {
      // Validar se arquivo foi enviado
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Nenhuma imagem foi enviada' });
        return;
      }

      // Validar dados da moto
      const { plate, model, year, status } = req.body;

      if (!plate || !model || !year) {
        res.status(400).json({
          success: false,
          error: 'Dados obrigatórios faltando: plate, model, year'
        });
        return;
      }

      // Upload da imagem para Supabase
      const imageUrl = await this.uploadService.uploadMotorcycleImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      // Criar moto com URL da imagem
      const motorcycleData = {
        plate,
        model,
        year: parseInt(year),
        status: status || 'Disponível',
        image_url: imageUrl
      };

      const motorcycle = await this.service.createMotorcycle(motorcycleData);

      res.status(201).json({ success: true, data: motorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error creating motorcycle with image:', error);
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

  updateMotorcycleWithImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Validar se arquivo foi enviado
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Nenhuma imagem foi enviada' });
        return;
      }

      // Obter moto atual para pegar URL da imagem antiga
      const currentMotorcycle = await this.service.getMotorcycleById(id);
      if (!currentMotorcycle) {
        res.status(404).json({ success: false, error: 'Moto não encontrada' });
        return;
      }

      // Upload da nova imagem
      const newImageUrl = await this.uploadService.uploadMotorcycleImage(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      // Atualizar dados da moto
      const updates: any = {
        image_url: newImageUrl
      };

      // Incluir outros campos se fornecidos
      if (req.body.plate) updates.plate = req.body.plate;
      if (req.body.model) updates.model = req.body.model;
      if (req.body.year) updates.year = parseInt(req.body.year);
      if (req.body.status) updates.status = req.body.status;

      const motorcycle = await this.service.updateMotorcycle(id, updates);

      // Deletar imagem antiga do storage (se existir)
      if (currentMotorcycle.image_url) {
        await this.uploadService.deleteMotorcycleImage(currentMotorcycle.image_url);
      }

      res.json({ success: true, data: motorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error updating motorcycle with image:', error);
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
