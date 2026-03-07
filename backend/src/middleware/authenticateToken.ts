import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; app_metadata: Record<string, unknown> };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação requerido' });
    return;
  }

  const { data: { user }, error } = await getSupabaseClient().auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  req.user = { id: user.id, email: user.email!, app_metadata: user.app_metadata };
  next();
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.app_metadata?.['created_via_dashboard']) {
    res.status(403).json({ error: 'Acesso restrito a administradores' });
    return;
  }
  next();
};
