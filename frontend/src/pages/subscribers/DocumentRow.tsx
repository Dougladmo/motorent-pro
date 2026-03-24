import React from 'react';
import { FileText, Image, Eye, Trash2, Loader2 } from 'lucide-react';
import { SubscriberDocument } from '../../shared/types/subscriber';
import { FILE_TYPE_LABELS } from './types';

interface DocumentRowProps {
  doc: SubscriberDocument;
  onView: () => void;
  onDelete: (id: string) => void;
  deleting?: boolean;
}

export const DocumentRow: React.FC<DocumentRowProps> = ({ doc, onView, onDelete, deleting }) => {
  const isPdf = doc.fileName.toLowerCase().endsWith('.pdf') || doc.fileUrl.includes('.pdf');

  return (
    <div className={`flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 transition-opacity ${deleting ? 'opacity-50 pointer-events-none' : ''}`}>
      {isPdf
        ? <FileText size={20} className="text-red-500 shrink-0" />
        : <Image size={20} className="text-red-600 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">
          {FILE_TYPE_LABELS[doc.fileType]}
          {doc.description && ` · ${doc.description}`}
        </p>
        <button
          type="button"
          onClick={onView}
          className="text-xs text-red-600 hover:underline truncate block text-left w-full"
        >
          {doc.fileName}
        </button>
      </div>
      <button
        type="button"
        onClick={onView}
        className="text-slate-400 hover:text-red-600 shrink-0"
        title="Visualizar documento"
      >
        <Eye size={16} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        disabled={deleting}
        className="text-slate-400 hover:text-red-500 shrink-0"
        title="Remover documento"
      >
        {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
      </button>
    </div>
  );
};
