import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Error Handler]', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        error: 'Arquivo muito grande. O tamanho máximo permitido é 50MB.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Erro no upload: ${err.message}`,
    });
    return;
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  res.json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
