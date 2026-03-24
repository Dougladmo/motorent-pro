import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { SubscriberDocument } from '../../shared/types/subscriber';
import { inputCls } from './types';

interface DocumentUploadFormProps {
  onUpload: (formData: FormData) => Promise<void>;
  uploadLoading?: boolean;
}

export const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({ onUpload, uploadLoading }) => {
  const [showForm, setShowForm] = useState(false);
  const [uploadForm, setUploadForm] = useState<{
    file: File | null;
    fileType: SubscriberDocument['fileType'];
    description: string;
  }>({ file: null, fileType: 'other', description: '' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadForm(u => ({ ...u, file }));
  };

  const handleSubmit = async () => {
    if (!uploadForm.file) return;
    const fd = new FormData();
    fd.append('file', uploadForm.file);
    fd.append('file_type', uploadForm.fileType);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    await onUpload(fd);
    setUploadForm({ file: null, fileType: 'other', description: '' });
    setShowForm(false);
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="mt-3 flex items-center gap-2 text-sm text-red-700 hover:underline"
      >
        <Upload size={16} /> Adicionar documento
      </button>
    );
  }

  return (
    <div className="mt-3 border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Novo documento</p>
        <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileChange}
        className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-red-50 file:text-red-800 hover:file:bg-red-100"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
          <select
            value={uploadForm.fileType}
            onChange={e => setUploadForm(u => ({ ...u, fileType: e.target.value as SubscriberDocument['fileType'] }))}
            className={inputCls}
          >
            <option value="contract">Contrato</option>
            <option value="cnh">CNH</option>
            <option value="photo">Foto</option>
            <option value="other">Outro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</label>
          <input
            type="text"
            value={uploadForm.description}
            onChange={e => setUploadForm(u => ({ ...u, description: e.target.value }))}
            className={inputCls}
            placeholder="Ex: CNH vencida em 2026"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!uploadForm.file || uploadLoading}
        className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
      >
        {uploadLoading && <Loader2 size={14} className="animate-spin" />}
        {uploadLoading ? 'Enviando...' : 'Enviar arquivo'}
      </button>
    </div>
  );
};
