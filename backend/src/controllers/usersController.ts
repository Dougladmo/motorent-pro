import { Response } from 'express';
import { getSupabaseClient } from '../config/supabase';
import { AuthRequest } from '../middleware/authenticateToken';

export const listUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  const { data, error } = await getSupabaseClient().auth.admin.listUsers();

  if (error) {
    res.status(500).json({ error: 'Erro ao listar usuários' });
    return;
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    isSuperAdmin: !u.app_metadata?.created_via_dashboard,
  }));

  res.json({ data: users });
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha são obrigatórios' });
    return;
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (typeof email !== 'string' || !emailRegex.test(email)) {
    res.status(400).json({ error: 'Email inválido' });
    return;
  }

  const { data, error } = await getSupabaseClient().auth.admin.createUser({
    email,
    password,
    app_metadata: { created_via_dashboard: true },
    email_confirm: true,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({
    data: {
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
      isSuperAdmin: false,
    },
  });
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params['id'] as string;

  const { data: userData, error: fetchError } = await getSupabaseClient().auth.admin.getUserById(id);

  if (fetchError || !userData.user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  if (!userData.user.app_metadata?.created_via_dashboard) {
    res.status(403).json({ error: 'Não é possível remover administradores' });
    return;
  }

  const { error } = await getSupabaseClient().auth.admin.deleteUser(id);

  if (error) {
    res.status(500).json({ error: 'Erro ao remover usuário' });
    return;
  }

  res.status(204).send();
};
