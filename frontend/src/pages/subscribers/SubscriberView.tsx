import React, { useState } from 'react';
import { SubscriberDocument } from '../../shared/types/subscriber';
import { formatPhone, formatCPF } from '../../shared';
import { SubFormState } from './types';
import { CollapsibleSection } from './CollapsibleSection';
import { DocumentRow } from './DocumentRow';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentCarousel } from './DocumentCarousel';

const ViewField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
};

interface SubscriberViewProps {
  form: SubFormState;
  documents: SubscriberDocument[];
  onDocumentDelete: (docId: string) => void;
  onDocumentUpload: (formData: FormData) => Promise<void>;
  uploadLoading: boolean;
  deletingDocId?: string | null;
  subscriberId?: string;
  onToggleReminders?: (enabled: boolean) => void;
}

export const SubscriberView: React.FC<SubscriberViewProps> = ({
  form, documents, onDocumentDelete, onDocumentUpload, uploadLoading, deletingDocId, subscriberId, onToggleReminders
}) => {
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

  const hasAddress = form.addressStreet || form.addressCity || form.addressZip;
  const hasRealDriver = !form.isRealDriver && form.realDriverName;

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Dados Básicos" contentClassName="px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <ViewField label="Nome" value={form.name} />
          <ViewField label="WhatsApp" value={formatPhone(form.phone)} />
          <ViewField label="CPF" value={form.document ? formatCPF(form.document) : null} />
          <ViewField label="Email" value={form.email} />
          <ViewField label="Data de Nascimento" value={form.birthDate ? new Date(form.birthDate + 'T12:00:00').toLocaleDateString('pt-BR') : null} />
          {form.notes && (
            <div className="sm:col-span-2">
              <ViewField label="Observações" value={form.notes} />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Notificações" contentClassName="px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Lembretes automáticos de pagamento</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {form.autoRemindersEnabled !== false
                ? 'O sistema envia lembretes automáticos via WhatsApp e email.'
                : 'Lembretes automáticos estão desativados para este assinante.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleReminders?.(!form.autoRemindersEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.autoRemindersEnabled !== false ? 'bg-green-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                form.autoRemindersEnabled !== false ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {form.autoRemindersEnabled === false && (
          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <strong>Atenção:</strong> Com os lembretes desativados, este assinante não receberá notificações automáticas de cobrança por WhatsApp ou email. Cobranças continuarão sendo geradas normalmente.
            </p>
          </div>
        )}
      </CollapsibleSection>

      {hasAddress && (
        <CollapsibleSection title="Endereço" defaultOpen={false} contentClassName="px-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <ViewField label="CEP" value={form.addressZip} />
            <ViewField label="Número" value={form.addressNumber} />
            <div className="sm:col-span-2">
              <ViewField label="Rua" value={form.addressStreet} />
            </div>
            <ViewField label="Complemento" value={form.addressComplement} />
            <ViewField label="Bairro" value={form.addressNeighborhood} />
            <ViewField label="Cidade" value={form.addressCity} />
            <ViewField label="UF" value={form.addressState} />
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Condutor Real" defaultOpen={false} contentClassName="px-4 py-4">
        <p className="text-sm text-slate-700 mb-3">
          {form.isRealDriver
            ? '✅ O assinante é o condutor real da moto.'
            : '⚠️ O assinante não é o condutor real.'}
        </p>
        {hasRealDriver && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div className="sm:col-span-2">
                <ViewField label="Nome do Condutor" value={form.realDriverName} />
              </div>
              <ViewField label="CPF do Condutor" value={form.realDriverDocument ? formatCPF(form.realDriverDocument) : null} />
              <ViewField label="WhatsApp do Condutor" value={form.realDriverPhone ? formatPhone(form.realDriverPhone) : null} />
              <ViewField label="Relação / Parentesco" value={form.realDriverRelationship} />
            </div>
            {(form.realDriverAddressStreet || form.realDriverAddressCity) && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Endereço do condutor</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <ViewField label="CEP" value={form.realDriverAddressZip} />
                  <ViewField label="Número" value={form.realDriverAddressNumber} />
                  <div className="sm:col-span-2">
                    <ViewField label="Rua" value={form.realDriverAddressStreet} />
                  </div>
                  <ViewField label="Complemento" value={form.realDriverAddressComplement} />
                  <ViewField label="Bairro" value={form.realDriverAddressNeighborhood} />
                  <ViewField label="Cidade" value={form.realDriverAddressCity} />
                  <ViewField label="UF" value={form.realDriverAddressState} />
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {subscriberId && (
        <CollapsibleSection
          title={`Documentos${documents.length > 0 ? ` (${documents.length})` : ''}`}
          defaultOpen={false}
          contentClassName="px-4 py-4"
        >
          <div className="space-y-2">
            {documents.length > 0
              ? documents.map((doc, idx) => (
                  <DocumentRow key={doc.id} doc={doc} onView={() => setCarouselIndex(idx)} onDelete={onDocumentDelete} deleting={deletingDocId === doc.id} />
                ))
              : <p className="text-sm text-slate-400">Nenhum documento anexado.</p>
            }
          </div>
          <DocumentUploadForm onUpload={onDocumentUpload} uploadLoading={uploadLoading} />
        </CollapsibleSection>
      )}

      {carouselIndex !== null && subscriberId && (
        <DocumentCarousel
          documents={documents}
          initialIndex={carouselIndex}
          subscriberId={subscriberId}
          onClose={() => setCarouselIndex(null)}
        />
      )}
    </div>
  );
};
