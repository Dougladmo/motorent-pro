import { Router } from 'express';
import { listUsers, createUser, deleteUser } from '../controllers/usersController';

const router = Router();

router.get('/', listUsers);
router.post('/', createUser);
router.delete('/:id', deleteUser);

export default router;
