import { Request, Response } from 'express';
import { SubscriberDocumentService } from '../services/subscriberDocumentService';

export class SubscriberDocumentController {
  constructor(private documentService: SubscriberDocumentService) {}

  getDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const docs = await this.documentService.getDocumentsBySubscriberId(id);
      res.json({ data: docs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'Nenhum arquivo enviado' });
        return;
      }

      const fileType = (req.body.file_type ?? 'other') as 'contract' | 'cnh' | 'photo' | 'other';
      const description = req.body.description as string | undefined;

      const doc = await this.documentService.addDocument(
        id,
        file.buffer,
        file.mimetype,
        file.originalname,
        fileType,
        description
      );

      res.status(201).json({ data: doc });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const docId = req.params['docId'] as string;
      await this.documentService.deleteDocument(docId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
