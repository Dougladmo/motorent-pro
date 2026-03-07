import React from 'react';
import { Upload, X } from 'lucide-react';

interface ImageUploadFieldProps {
  label: string;
  imagePreview: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  onError?: (message: string) => void;
  editMode?: boolean;
  hasNewImage?: boolean;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  imagePreview,
  onImageSelect,
  onImageRemove,
  onError,
  editMode = false,
  hasNewImage = false
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        onError?.('Tipo de arquivo não permitido. Use JPEG, JPG, PNG ou WEBP.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        onError?.('Arquivo muito grande. Tamanho máximo: 5MB.');
        return;
      }

      onImageSelect(file);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        <span className="text-xs text-slate-500 ml-2 font-normal">
          {/Mobile|Android|iPhone/i.test(navigator.userAgent)
            ? '(tire uma foto ou escolha da galeria)'
            : '(selecione um arquivo)'}
        </span>
      </label>

      {imagePreview ? (
        <div className="relative">
          <img
            src={imagePreview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border-2 border-slate-200"
          />
          <button
            type="button"
            onClick={onImageRemove}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors"
            title="Remover imagem"
          >
            <X size={16} />
          </button>
          {editMode && hasNewImage && (
            <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
              Nova imagem selecionada
            </div>
          )}
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
          <Upload className="text-slate-400 mb-2" size={32} />
          <span className="text-sm text-slate-500">
            {editMode ? 'Clique para alterar a foto' : 'Clique para selecionar uma foto'}
          </span>
          <span className="text-xs text-slate-400 mt-1">JPEG, PNG ou WEBP (máx. 5MB)</span>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};
