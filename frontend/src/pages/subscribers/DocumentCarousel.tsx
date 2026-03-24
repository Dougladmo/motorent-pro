import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, FileText, Image, X, Loader2 } from 'lucide-react';
import { SubscriberDocument } from '../../shared/types/subscriber';
import { subscriberDocumentApi } from '../../services/api';
import { FILE_TYPE_LABELS, getMimeType } from './types';

type BlobEntry = { blobUrl: string | null; loading: boolean; error: boolean };

interface DocumentCarouselProps {
  documents: SubscriberDocument[];
  initialIndex: number;
  subscriberId: string;
  onClose: () => void;
}

export const DocumentCarousel: React.FC<DocumentCarouselProps> = ({
  documents, initialIndex, subscriberId, onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [blobCache, setBlobCache] = useState<Record<number, BlobEntry>>({});
  const blobCacheRef = useRef<Record<number, BlobEntry>>({});

  const goTo = (idx: number) =>
    setCurrentIndex(Math.max(0, Math.min(documents.length - 1, idx)));

  const isImage = (doc: SubscriberDocument) =>
    /\.(jpg|jpeg|png|webp)$/i.test(doc.fileName);

  const setCacheEntry = (idx: number, entry: BlobEntry) => {
    setBlobCache(prev => {
      const next = { ...prev, [idx]: entry };
      blobCacheRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (blobCache[currentIndex]) return;
    setCacheEntry(currentIndex, { blobUrl: null, loading: true, error: false });

    let cancelled = false;
    (async () => {
      try {
        const signedUrl = await subscriberDocumentApi.getSignedUrl(subscriberId, documents[currentIndex].id);
        const res = await fetch(signedUrl);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const mimeType = getMimeType(documents[currentIndex].fileName);
        const blobUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mimeType }));
        setCacheEntry(currentIndex, { blobUrl, loading: false, error: false });
      } catch {
        if (!cancelled) setCacheEntry(currentIndex, { blobUrl: null, loading: false, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [currentIndex]);

  useEffect(() => () => {
    Object.values(blobCacheRef.current).forEach(e => {
      if (e.blobUrl) URL.revokeObjectURL(e.blobUrl);
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [currentIndex]);

  const doc = documents[currentIndex];
  const entry = blobCache[currentIndex];

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/60">
        <span className="text-slate-400 text-sm tabular-nums">{currentIndex + 1} / {documents.length}</span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center px-4">
          {/\.pdf$/i.test(doc.fileName)
            ? <FileText size={16} className="text-red-400 shrink-0" />
            : <Image size={16} className="text-red-500 shrink-0" />
          }
          <span className="text-sm font-medium text-white truncate">{doc.fileName}</span>
          <span className="text-xs text-slate-400 shrink-0">{FILE_TYPE_LABELS[doc.fileType]}</span>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 px-14">
        <button
          type="button"
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="absolute left-3 text-white disabled:opacity-20 hover:text-slate-300 p-2"
        >
          <ChevronLeft size={32} />
        </button>

        <div key={currentIndex} className="w-full h-full flex items-center justify-center">
          {!entry || entry.loading ? (
            <Loader2 size={40} className="animate-spin text-slate-400" />
          ) : entry.error ? (
            <p className="text-red-400 text-sm">Erro ao carregar documento.</p>
          ) : isImage(doc) ? (
            <img src={entry.blobUrl!} alt={doc.fileName} className="max-w-full max-h-full object-contain" />
          ) : (
            <iframe src={entry.blobUrl!} title={doc.fileName} className="w-full h-full border-0" />
          )}
        </div>

        <button
          type="button"
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === documents.length - 1}
          className="absolute right-3 text-white disabled:opacity-20 hover:text-slate-300 p-2"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {documents.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-3 bg-black/60">
          {documents.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${i === currentIndex ? 'w-3 h-3 bg-white' : 'w-2 h-2 bg-slate-500 hover:bg-slate-300'}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};
