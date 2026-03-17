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
      const { status } = req.query;

      // Se status query param foi fornecido, filtrar por status
      if (status && typeof status === 'string') {
        const motorcycles = await this.service.getMotorcyclesByStatus(status);
        res.json({ success: true, data: motorcycles });
        return;
      }

      // Senão, retornar todas
      const motorcycles = await this.service.getAllMotorcycles();
      res.json({ success: true, data: motorcycles });
    } catch (error: any) {
      console.error('[MotorcycleController] Error fetching motorcycles:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getMotorcycleById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
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
      const status = req.query.status as string;

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

      const { plate, model, year, status } = req.body;

      if (!plate) {
        res.status(400).json({ success: false, error: 'Placa da moto é obrigatória.' });
        return;
      }
      if (!model) {
        res.status(400).json({ success: false, error: 'Modelo da moto é obrigatório.' });
        return;
      }
      if (!year) {
        res.status(400).json({ success: false, error: 'Ano da moto é obrigatório.' });
        return;
      }
      const parsedYear = parseInt(year);
      if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear() + 1) {
        res.status(400).json({ success: false, error: `Ano "${year}" é inválido.` });
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
        year: parsedYear,
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

  updateMotorcycleImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, error: 'Nenhuma imagem fornecida' });
        return;
      }

      // 1. Buscar moto existente para pegar URL da imagem antiga
      const existingMoto = await this.service.getMotorcycleById(id);

      if (!existingMoto) {
        res.status(404).json({ success: false, error: 'Moto não encontrada' });
        return;
      }

      // 2. Upload da nova imagem
      const imageUrl = await this.uploadService.uploadMotorcycleImage(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      // 3. Preparar dados para atualização (incluir dados da moto se fornecidos)
      const { plate, model, year, status } = req.body;
      const updateData: any = {
        image_url: imageUrl
      };

      // Adicionar outros campos se foram fornecidos
      if (plate) updateData.plate = plate;
      if (model) updateData.model = model;
      if (year) updateData.year = parseInt(year);
      if (status) updateData.status = status;

      // 4. Atualizar registro com nova imagem e outros dados
      const updatedMotorcycle = await this.service.updateMotorcycle(id, updateData);

      // 5. Deletar imagem antiga do storage (se existir)
      if (existingMoto.image_url) {
        await this.uploadService.deleteMotorcycleImage(existingMoto.image_url);
      }

      res.json({ success: true, data: updatedMotorcycle });
    } catch (error: any) {
      console.error('[MotorcycleController] Error updating motorcycle image:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  updateMotorcycle = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
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
      const id = req.params.id as string;
      await this.service.deleteMotorcycle(id);
      res.json({ success: true, message: 'Moto deletada com sucesso' });
    } catch (error: any) {
      console.error('[MotorcycleController] Error deleting motorcycle:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };
}
