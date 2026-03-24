import React, { useState } from 'react';
import { SubscriberDocument } from '../../shared/types/subscriber';
import { formatPhone, formatCPF } from '../../shared';
import { SubFormState, inputCls } from './types';
import { CollapsibleSection } from './CollapsibleSection';
import { DocumentRow } from './DocumentRow';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentCarousel } from './DocumentCarousel';

const Field: React.FC<{ label: string; optional?: boolean; children: React.ReactNode }> = ({
  label, optional, children
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {label} {optional && <span className="text-slate-400 font-normal">(opcional)</span>}
    </label>
    {children}
  </div>
);

interface SubscriberFormProps {
  form: SubFormState;
  onChange: (f: SubFormState) => void;
  onCepBlur: () => void;
  onRealDriverCepBlur: () => void;
  isEdit?: boolean;
  subscriberId?: string;
  documents?: SubscriberDocument[];
  onDocumentUpload?: (formData: FormData) => Promise<void>;
  onDocumentDelete?: (docId: string) => void;
  uploadLoading?: boolean;
  deletingDocId?: string | null;
}

export const SubscriberForm: React.FC<SubscriberFormProps> = ({
  form, onChange, onCepBlur, onRealDriverCepBlur, isEdit, subscriberId,
  documents, onDocumentUpload, onDocumentDelete, uploadLoading, deletingDocId
}) => {
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);
  const set = (partial: Partial<SubFormState>) => onChange({ ...form, ...partial });

  return (
    <div className="space-y-3">
      <CollapsibleSection title="Dados Básicos">
        <Field label="Nome Completo">
          <input required type="text" value={form.name}
            onChange={e => set({ name: e.target.value })}
            className={inputCls} placeholder="Ex: João Silva" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="WhatsApp">
            <input required type="tel" placeholder="(00) 00000-0000"
              value={formatPhone(form.phone)}
              onChange={e => set({ phone: e.target.value.replace(/\D/g, '') })}
              className={inputCls} />
          </Field>
          <Field label="CPF" optional>
            <input type="text" value={formatCPF(form.document)}
              onChange={e => set({ document: e.target.value.replace(/\D/g, '') })}
              className={inputCls} placeholder="000.000.000-00" maxLength={14} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" optional>
            <input type="email" value={form.email}
              onChange={e => set({ email: e.target.value })}
              className={inputCls} placeholder="exemplo@email.com" />
          </Field>
          <Field label="Data de Nascimento" optional>
            <input type="date" value={form.birthDate}
              onChange={e => set({ birthDate: e.target.value })}
              className={inputCls} />
          </Field>
        </div>
        <Field label="Observações" optional>
          <textarea rows={2} value={form.notes}
            onChange={e => set({ notes: e.target.value })}
            className={inputCls + ' resize-none'} placeholder="Observações gerais..." />
        </Field>
      </CollapsibleSection>

      <CollapsibleSection title="Endereço" defaultOpen={false}>
        <Field label="CEP" optional>
          <input type="text" value={form.addressZip}
            onChange={e => set({ addressZip: e.target.value.replace(/\D/g, '') })}
            onBlur={onCepBlur}
            className={inputCls} placeholder="00000-000" maxLength={9} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Rua" optional>
              <input type="text" value={form.addressStreet}
                onChange={e => set({ addressStreet: e.target.value })}
                className={inputCls} placeholder="Nome da rua" />
            </Field>
          </div>
          <Field label="Número" optional>
            <input type="text" value={form.addressNumber}
              onChange={e => set({ addressNumber: e.target.value })}
              className={inputCls} placeholder="Nº" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Complemento" optional>
            <input type="text" value={form.addressComplement}
              onChange={e => set({ addressComplement: e.target.value })}
              className={inputCls} placeholder="Apto, bloco..." />
          </Field>
          <Field label="Bairro" optional>
            <input type="text" value={form.addressNeighborhood}
              onChange={e => set({ addressNeighborhood: e.target.value })}
              className={inputCls} placeholder="Bairro" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Cidade" optional>
              <input type="text" value={form.addressCity}
                onChange={e => set({ addressCity: e.target.value })}
                className={inputCls} placeholder="Cidade" />
            </Field>
          </div>
          <Field label="UF" optional>
            <input type="text" value={form.addressState}
              onChange={e => set({ addressState: e.target.value.toUpperCase() })}
              className={inputCls} placeholder="SP" maxLength={2} />
          </Field>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Condutor Real" defaultOpen={false}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRealDriver}
              onChange={e => set({ isRealDriver: e.target.checked })}
              className="w-4 h-4 accent-red-700"
            />
            <span className="text-sm font-medium text-slate-700">O assinante é o condutor real da moto</span>
          </label>
        </div>

        {!form.isRealDriver && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">Preencha os dados de quem realmente utilizará a moto:</p>
            <Field label="Nome do Condutor">
              <input type="text" value={form.realDriverName}
                onChange={e => set({ realDriverName: e.target.value })}
                className={inputCls} placeholder="Nome completo" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CPF do Condutor">
                <input type="text" value={formatCPF(form.realDriverDocument ?? '')}
                  onChange={e => set({ realDriverDocument: e.target.value.replace(/\D/g, '') })}
                  className={inputCls} placeholder="000.000.000-00" maxLength={14} />
              </Field>
              <Field label="WhatsApp do Condutor">
                <input type="tel" value={formatPhone(form.realDriverPhone ?? '')}
                  onChange={e => set({ realDriverPhone: e.target.value.replace(/\D/g, '') })}
                  className={inputCls} placeholder="(00) 00000-0000" />
              </Field>
            </div>
            <Field label="Relação / Parentesco" optional>
              <input type="text" value={form.realDriverRelationship ?? ''}
                onChange={e => set({ realDriverRelationship: e.target.value })}
                className={inputCls} placeholder="Ex: Filho, funcionário, cônjuge..." />
            </Field>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-3">Endereço do condutor</p>
              <div className="space-y-3">
                <Field label="CEP" optional>
                  <input type="text" value={form.realDriverAddressZip ?? ''}
                    onChange={e => set({ realDriverAddressZip: e.target.value.replace(/\D/g, '') })}
                    onBlur={onRealDriverCepBlur}
                    className={inputCls} placeholder="00000-000" maxLength={9} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Rua" optional>
                      <input type="text" value={form.realDriverAddressStreet ?? ''}
                        onChange={e => set({ realDriverAddressStreet: e.target.value })}
                        className={inputCls} placeholder="Nome da rua" />
                    </Field>
                  </div>
                  <Field label="Número" optional>
                    <input type="text" value={form.realDriverAddressNumber ?? ''}
                      onChange={e => set({ realDriverAddressNumber: e.target.value })}
                      className={inputCls} placeholder="Nº" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Complemento" optional>
                    <input type="text" value={form.realDriverAddressComplement ?? ''}
                      onChange={e => set({ realDriverAddressComplement: e.target.value })}
                      className={inputCls} placeholder="Apto, bloco..." />
                  </Field>
                  <Field label="Bairro" optional>
                    <input type="text" value={form.realDriverAddressNeighborhood ?? ''}
                      onChange={e => set({ realDriverAddressNeighborhood: e.target.value })}
                      className={inputCls} placeholder="Bairro" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Cidade" optional>
                      <input type="text" value={form.realDriverAddressCity ?? ''}
                        onChange={e => set({ realDriverAddressCity: e.target.value })}
                        className={inputCls} placeholder="Cidade" />
                    </Field>
                  </div>
                  <Field label="UF" optional>
                    <input type="text" value={form.realDriverAddressState ?? ''}
                      onChange={e => set({ realDriverAddressState: e.target.value.toUpperCase() })}
                      className={inputCls} placeholder="SP" maxLength={2} />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {isEdit && subscriberId && documents && onDocumentUpload && (
        <CollapsibleSection title="Documentos" defaultOpen={false}>
          <div className="space-y-2">
            {documents.length > 0
              ? documents.map((doc, idx) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onView={() => setCarouselIndex(idx)}
                    onDelete={id => onDocumentDelete?.(id)}
                    deleting={deletingDocId === doc.id}
                  />
                ))
              : <p className="text-sm text-slate-400">Nenhum documento anexado.</p>
            }
          </div>
          <DocumentUploadForm onUpload={onDocumentUpload} uploadLoading={uploadLoading} />
        </CollapsibleSection>
      )}

      {carouselIndex !== null && subscriberId && documents && (
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
