import React from 'react';
import { Send, Check, Trash2, X, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkReminder: () => void;
  onBulkMarkPaid: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  reminderQueue: {
    isRunning: boolean;
    completed: string[];
    failed: string[];
    totalEnqueued: number;
    processing: string | null;
  };
  onCancelQueue: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onBulkReminder,
  onBulkMarkPaid,
  onBulkDelete,
  onClearSelection,
  reminderQueue,
  onCancelQueue,
}) => {
  if (selectedCount === 0 && !reminderQueue.isRunning) return null;

  const sent = reminderQueue.completed.length + reminderQueue.failed.length;
  const progress = reminderQueue.totalEnqueued > 0
    ? Math.round((sent / reminderQueue.totalEnqueued) * 100)
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:left-64">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Progress bar during queue processing */}
          {reminderQueue.isRunning && (
            <div className="h-1 bg-slate-100">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            {/* Left: selection count / queue progress */}
            <div className="flex items-center gap-3 min-w-0">
              {reminderQueue.isRunning ? (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-800">
                      Enviando {sent + 1} de {reminderQueue.totalEnqueued}
                    </span>
                    {reminderQueue.failed.length > 0 && (
                      <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
                        {reminderQueue.failed.length} {reminderQueue.failed.length === 1 ? 'falha' : 'falhas'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={onCancelQueue}
                    className="ml-1 px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
                    {selectedCount}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {selectedCount === 1 ? 'selecionado' : 'selecionados'}
                  </span>
                </div>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2">
              {!reminderQueue.isRunning && (
                <>
                  <button
                    onClick={onBulkReminder}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-colors"
                    title="Disparar Lembretes"
                  >
                    <Send size={14} />
                    <span className="hidden sm:inline">Lembretes</span>
                  </button>
                  <button
                    onClick={onBulkMarkPaid}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full transition-colors"
                    title="Aprovar Pagamentos"
                  >
                    <Check size={14} />
                    <span className="hidden sm:inline">Aprovar</span>
                  </button>
                  <button
                    onClick={onBulkDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-colors"
                    title="Deletar Selecionados"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Deletar</span>
                  </button>
                  <button
                    onClick={onClearSelection}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Limpar seleção"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
