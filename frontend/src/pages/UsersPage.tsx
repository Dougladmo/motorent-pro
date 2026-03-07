import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, User } from 'lucide-react';
import { userApi, AdminUser } from '../services/api';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userApi.getAll();
      setUsers(data);
    } catch {
      setError('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await userApi.create(email, password);
      setShowModal(false);
      setEmail('');
      setPassword('');
      await loadUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar usuário';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await userApi.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover usuário';
      alert(msg);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie os administradores do sistema</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(null); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={16} />
          Novo Admin
        </button>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Carregando...</div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Usuário</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Criado em</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-750">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                        <User size={14} className="text-slate-300" />
                      </div>
                      <span className="text-white text-sm">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.isSuperAdmin ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-900/30 border border-blue-800 px-2 py-1 rounded-full w-fit">
                        <Shield size={11} />
                        Administrador
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 bg-slate-700 border border-slate-600 px-2 py-1 rounded-full">
                        Usuário
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!u.isSuperAdmin && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded"
                        title="Remover usuário"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Novo Administrador</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@motorent.com"
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
