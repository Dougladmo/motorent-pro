import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { subscriberApi } from '../services/api';
import { MotorcycleStatus, Subscriber, PaymentStatus } from '../shared';
import { Plus, Check, AlertTriangle, ChevronDown, ChevronUp, FileText, Image, Trash2, Upload, X, Pencil } from 'lucide-react';
import { WEEK_DAYS } from '../shared';
import { validatePhone, validateCPF, validatePositiveNumber } from '../shared';
import { formatPhone, formatCPF, formatCurrency, capitalizeName } from '../shared';
import { SubscriberGrid } from '../entities/subscriber/ui/SubscriberGrid';
import { AlertDialog } from '../components/AlertDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Modal } from '../components/Modal';
import { SubscriberDocument } from '../shared/types/subscriber';

// ─── CEP lookup ──────────────────────────────────────────────────────────────
async function fetchCep(cep: string) {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
};

// ─── Field helpers ────────────────────────────────────────────────────────────
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

const inputCls = "w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ─── Initial form states ──────────────────────────────────────────────────────
const emptySubForm = () => ({
  name: '', phone: '', document: '', email: '', notes: '',
  birthDate: '',
  addressZip: '', addressStreet: '', addressNumber: '', addressComplement: '',
  addressNeighborhood: '', addressCity: '', addressState: '',
  isRealDriver: true,
  realDriverName: '', realDriverDocument: '', realDriverPhone: '', realDriverRelationship: '',
  realDriverAddressZip: '', realDriverAddressStreet: '', realDriverAddressNumber: '',
  realDriverAddressComplement: '', realDriverAddressNeighborhood: '',
  realDriverAddressCity: '', realDriverAddressState: ''
});

type SubFormState = ReturnType<typeof emptySubForm>;

// ─── File type labels ─────────────────────────────────────────────────────────
const FILE_TYPE_LABELS: Record<SubscriberDocument['fileType'], string> = {
  contract: 'Contrato',
  cnh: 'CNH',
  photo: 'Foto',
  other: 'Outro'
};

// ─── Document row ─────────────────────────────────────────────────────────────
const DocumentRow: React.FC<{
  doc: SubscriberDocument;
  onDelete: (id: string) => void;
}> = ({ doc, onDelete }) => {
  const isPdf = doc.fileName.toLowerCase().endsWith('.pdf') || doc.fileUrl.includes('.pdf');
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      {isPdf
        ? <FileText size={20} className="text-red-500 shrink-0" />
        : <Image size={20} className="text-blue-500 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-blue-600 hover:underline truncate block"
        >
          {doc.fileName}
        </a>
        <p className="text-xs text-slate-500">
          {FILE_TYPE_LABELS[doc.fileType]}
          {doc.description && ` · ${doc.description}`}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(doc.id)}
        className="text-slate-400 hover:text-red-500 shrink-0"
        title="Remover documento"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

// ─── Read-only view ───────────────────────────────────────────────────────────
const ViewField: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
};

const ViewSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, children, defaultOpen = true
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {title}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
};

const SubscriberView: React.FC<{
  form: SubFormState;
  documents: SubscriberDocument[];
  onDocumentDelete: (docId: string) => void;
  onDocumentUpload: (formData: FormData) => void;
  uploadLoading: boolean;
  subscriberId?: string;
}> = ({ form, documents, onDocumentDelete, onDocumentUpload, uploadLoading, subscriberId }) => {
  const [uploadForm, setUploadForm] = useState<{ file: File | null; fileType: SubscriberDocument['fileType']; description: string }>({
    file: null, fileType: 'other', description: ''
  });
  const [showUploadRow, setShowUploadRow] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadForm(u => ({ ...u, file }));
  };

  const handleUploadSubmit = () => {
    if (!uploadForm.file) return;
    const fd = new FormData();
    fd.append('file', uploadForm.file);
    fd.append('file_type', uploadForm.fileType);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    onDocumentUpload(fd);
    setUploadForm({ file: null, fileType: 'other', description: '' });
    setShowUploadRow(false);
  };

  const hasAddress = form.addressStreet || form.addressCity || form.addressZip;
  const hasRealDriver = !form.isRealDriver && form.realDriverName;

  return (
    <div className="space-y-3">
      <ViewSection title="Dados Básicos">
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
      </ViewSection>

      {hasAddress && (
        <ViewSection title="Endereço" defaultOpen={false}>
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
        </ViewSection>
      )}

      <ViewSection title="Condutor Real" defaultOpen={false}>
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
      </ViewSection>

      {subscriberId && (
        <ViewSection title={`Documentos${documents.length > 0 ? ` (${documents.length})` : ''}`} defaultOpen={false}>
          <div className="space-y-2">
            {documents.length > 0
              ? documents.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} onDelete={onDocumentDelete} />
                ))
              : <p className="text-sm text-slate-400">Nenhum documento anexado.</p>
            }
          </div>
          {!showUploadRow ? (
            <button
              type="button"
              onClick={() => setShowUploadRow(true)}
              className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Upload size={16} /> Adicionar documento
            </button>
          ) : (
            <div className="mt-3 border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Novo documento</p>
                <button type="button" onClick={() => setShowUploadRow(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                onClick={handleUploadSubmit}
                disabled={!uploadForm.file || uploadLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {uploadLoading ? 'Enviando...' : 'Enviar arquivo'}
              </button>
            </div>
          )}
        </ViewSection>
      )}
    </div>
  );
};

// ─── Subscriber form (shared between NEW_SUB and Edit modal) ─────────────────
const SubscriberForm: React.FC<{
  form: SubFormState;
  onChange: (f: SubFormState) => void;
  onCepBlur: () => void;
  onRealDriverCepBlur: () => void;
  isEdit?: boolean;
  subscriberId?: string;
  documents?: SubscriberDocument[];
  onDocumentUpload?: (formData: FormData) => void;
  onDocumentDelete?: (docId: string) => void;
  uploadLoading?: boolean;
}> = ({ form, onChange, onCepBlur, onRealDriverCepBlur, isEdit, subscriberId, documents, onDocumentUpload, onDocumentDelete, uploadLoading }) => {
  const [uploadForm, setUploadForm] = useState<{ file: File | null; fileType: SubscriberDocument['fileType']; description: string }>({
    file: null, fileType: 'other', description: ''
  });
  const [showUploadRow, setShowUploadRow] = useState(false);

  const set = (partial: Partial<SubFormState>) => onChange({ ...form, ...partial });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setUploadForm(u => ({ ...u, file }));
  };

  const handleUploadSubmit = () => {
    if (!uploadForm.file || !onDocumentUpload) return;
    const fd = new FormData();
    fd.append('file', uploadForm.file);
    fd.append('file_type', uploadForm.fileType);
    if (uploadForm.description) fd.append('description', uploadForm.description);
    onDocumentUpload(fd);
    setUploadForm({ file: null, fileType: 'other', description: '' });
    setShowUploadRow(false);
  };

  return (
    <div className="space-y-3">
      {/* Seção 1 — Dados Básicos */}
      <Section title="Dados Básicos" defaultOpen>
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
      </Section>

      {/* Seção 2 — Endereço */}
      <Section title="Endereço" defaultOpen={false}>
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
      </Section>

      {/* Seção 3 — Condutor Real */}
      <Section title="Condutor Real" defaultOpen={false}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRealDriver}
              onChange={e => set({ isRealDriver: e.target.checked })}
              className="w-4 h-4 accent-blue-600"
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
      </Section>

      {/* Seção 4 — Documentos (somente no modal de edição) */}
      {isEdit && subscriberId && (
        <Section title="Documentos" defaultOpen={false}>
          <div className="space-y-2">
            {documents && documents.length > 0
              ? documents.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} onDelete={id => onDocumentDelete?.(id)} />
                ))
              : <p className="text-sm text-slate-400">Nenhum documento anexado.</p>
            }
          </div>

          {!showUploadRow ? (
            <button
              type="button"
              onClick={() => setShowUploadRow(true)}
              className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              <Upload size={16} /> Adicionar documento
            </button>
          ) : (
            <div className="mt-3 border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Novo documento</p>
                <button type="button" onClick={() => setShowUploadRow(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
                onClick={handleUploadSubmit}
                disabled={!uploadForm.file || uploadLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {uploadLoading ? 'Enviando...' : 'Enviar arquivo'}
              </button>
            </div>
          )}
        </Section>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const Subscribers: React.FC = () => {
  const {
    subscribers, motorcycles, loading, addSubscriber, updateSubscriber,
    createRental, rentals, payments, deleteSubscriber, terminateRental,
    getSubscriberDocuments, addSubscriberDocument, deleteSubscriberDocument
  } = useApp();

  const [view, setView] = useState<'LIST' | 'NEW_SUB' | 'NEW_RENTAL'>('LIST');
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [subForm, setSubForm] = useState<SubFormState>(emptySubForm());
  const [rentalForm, setRentalForm] = useState({
    subscriberId: '',
    motorcycleId: '',
    weeklyValue: 250,
    dueDayOfWeek: 1,
    contractDurationMonths: 12
  });

  // Documents state
  const [documents, setDocuments] = useState<SubscriberDocument[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Dialogs
  const [alertDialog, setAlertDialog] = useState<{ message: string; variant: 'success' | 'error' | 'warning' | 'info'; title?: string } | null>(null);
  const [terminatingRental, setTerminatingRental] = useState<{ rentalId: string; subscriberName: string; bikePlate: string; outstandingBalance: number } | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  // ─── CEP lookup ────────────────────────────────────────────────────────────
  const handleCepBlur = async () => {
    const cep = subForm.addressZip;
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    const data = await fetchCep(cep);
    if (!data) return;
    setSubForm(f => ({
      ...f,
      addressStreet: data.logradouro || f.addressStreet,
      addressNeighborhood: data.bairro || f.addressNeighborhood,
      addressCity: data.localidade || f.addressCity,
      addressState: data.uf || f.addressState
    }));
  };

  const handleRealDriverCepBlur = async () => {
    const cep = subForm.realDriverAddressZip;
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;
    const data = await fetchCep(cep);
    if (!data) return;
    setSubForm(f => ({
      ...f,
      realDriverAddressStreet: data.logradouro || f.realDriverAddressStreet,
      realDriverAddressNeighborhood: data.bairro || f.realDriverAddressNeighborhood,
      realDriverAddressCity: data.localidade || f.realDriverAddressCity,
      realDriverAddressState: data.uf || f.realDriverAddressState
    }));
  };

  // ─── Build subscriber payload ───────────────────────────────────────────────
  const buildSubscriberPayload = (f: SubFormState) => ({
    name: capitalizeName(f.name),
    phone: f.phone,
    document: f.document,
    email: f.email || undefined,
    notes: f.notes || undefined,
    active: true,
    birth_date: f.birthDate || null,
    address_zip: f.addressZip || null,
    address_street: f.addressStreet || null,
    address_number: f.addressNumber || null,
    address_complement: f.addressComplement || null,
    address_neighborhood: f.addressNeighborhood || null,
    address_city: f.addressCity || null,
    address_state: f.addressState || null,
    is_real_driver: f.isRealDriver,
    real_driver_name: f.isRealDriver ? null : (f.realDriverName || null),
    real_driver_document: f.isRealDriver ? null : (f.realDriverDocument || null),
    real_driver_phone: f.isRealDriver ? null : (f.realDriverPhone || null),
    real_driver_relationship: f.isRealDriver ? null : (f.realDriverRelationship || null),
    real_driver_address_zip: f.isRealDriver ? null : (f.realDriverAddressZip || null),
    real_driver_address_street: f.isRealDriver ? null : (f.realDriverAddressStreet || null),
    real_driver_address_number: f.isRealDriver ? null : (f.realDriverAddressNumber || null),
    real_driver_address_complement: f.isRealDriver ? null : (f.realDriverAddressComplement || null),
    real_driver_address_neighborhood: f.isRealDriver ? null : (f.realDriverAddressNeighborhood || null),
    real_driver_address_city: f.isRealDriver ? null : (f.realDriverAddressCity || null),
    real_driver_address_state: f.isRealDriver ? null : (f.realDriverAddressState || null)
  });

  // ─── Create / Update subscriber ─────────────────────────────────────────────
  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subForm.name.trim()) {
      setAlertDialog({ message: 'Nome é obrigatório.', variant: 'warning' });
      return;
    }
    if (!validatePhone(subForm.phone)) {
      setAlertDialog({ message: 'Telefone inválido. Use o formato (00) 00000-0000.', variant: 'warning' });
      return;
    }
    if (subForm.document && !validateCPF(subForm.document)) {
      setAlertDialog({ message: 'CPF inválido.', variant: 'warning' });
      return;
    }

    try {
      const payload = buildSubscriberPayload(subForm);
      if (editingSubscriber) {
        await updateSubscriber(editingSubscriber.id, payload as any);
        handleCloseModal();
      } else {
        await addSubscriber(payload as any);
        setView('LIST');
        setSubForm(emptySubForm());
      }
    } catch (error) {
      console.error('Erro ao salvar assinante:', error);
      setAlertDialog({ message: 'Erro ao salvar assinante. Tente novamente.', variant: 'error' });
    }
  };

  // ─── Open edit modal ─────────────────────────────────────────────────────────
  const handleEditClick = async (subscriber: Subscriber) => {
    try {
      const fresh = await subscriberApi.getById(subscriber.id) as any;
      setEditingSubscriber(subscriber);
      setSubForm({
        name: fresh.name ?? subscriber.name,
        phone: fresh.phone ?? subscriber.phone,
        document: fresh.document ?? subscriber.document,
        email: fresh.email ?? subscriber.email ?? '',
        notes: fresh.notes ?? subscriber.notes ?? '',
        birthDate: fresh.birth_date ?? subscriber.birthDate ?? '',
        addressZip: fresh.address_zip ?? subscriber.addressZip ?? '',
        addressStreet: fresh.address_street ?? subscriber.addressStreet ?? '',
        addressNumber: fresh.address_number ?? subscriber.addressNumber ?? '',
        addressComplement: fresh.address_complement ?? subscriber.addressComplement ?? '',
        addressNeighborhood: fresh.address_neighborhood ?? subscriber.addressNeighborhood ?? '',
        addressCity: fresh.address_city ?? subscriber.addressCity ?? '',
        addressState: fresh.address_state ?? subscriber.addressState ?? '',
        isRealDriver: fresh.is_real_driver ?? subscriber.isRealDriver ?? true,
        realDriverName: fresh.real_driver_name ?? subscriber.realDriverName ?? '',
        realDriverDocument: fresh.real_driver_document ?? subscriber.realDriverDocument ?? '',
        realDriverPhone: fresh.real_driver_phone ?? subscriber.realDriverPhone ?? '',
        realDriverRelationship: fresh.real_driver_relationship ?? subscriber.realDriverRelationship ?? '',
        realDriverAddressZip: fresh.real_driver_address_zip ?? subscriber.realDriverAddressZip ?? '',
        realDriverAddressStreet: fresh.real_driver_address_street ?? subscriber.realDriverAddressStreet ?? '',
        realDriverAddressNumber: fresh.real_driver_address_number ?? subscriber.realDriverAddressNumber ?? '',
        realDriverAddressComplement: fresh.real_driver_address_complement ?? subscriber.realDriverAddressComplement ?? '',
        realDriverAddressNeighborhood: fresh.real_driver_address_neighborhood ?? subscriber.realDriverAddressNeighborhood ?? '',
        realDriverAddressCity: fresh.real_driver_address_city ?? subscriber.realDriverAddressCity ?? '',
        realDriverAddressState: fresh.real_driver_address_state ?? subscriber.realDriverAddressState ?? ''
      });

      // Load documents
      const docs = await getSubscriberDocuments(subscriber.id);
      setDocuments(docs);
    } catch {
      setEditingSubscriber(subscriber);
      setSubForm({ ...emptySubForm(), name: subscriber.name, phone: subscriber.phone, document: subscriber.document, email: subscriber.email ?? '', isRealDriver: subscriber.isRealDriver ?? true });
      setDocuments([]);
    }
    setIsViewModalOpen(true);
    setIsEditing(false);
  };

  const handleCloseModal = () => {
    setIsViewModalOpen(false);
    setIsEditing(false);
    setEditingSubscriber(null);
    setSubForm(emptySubForm());
    setDocuments([]);
  };

  // ─── Document handlers ────────────────────────────────────────────────────────
  const handleDocumentUpload = async (formData: FormData) => {
    if (!editingSubscriber) return;
    setUploadLoading(true);
    try {
      const doc = await addSubscriberDocument(editingSubscriber.id, formData);
      setDocuments(prev => [doc, ...prev]);
    } catch (error: any) {
      setAlertDialog({ message: `Erro ao enviar documento: ${error.message}`, variant: 'error' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDocumentDelete = async (docId: string) => {
    if (!editingSubscriber) return;
    try {
      await deleteSubscriberDocument(editingSubscriber.id, docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (error: any) {
      setAlertDialog({ message: `Erro ao remover documento: ${error.message}`, variant: 'error' });
    }
  };

  // ─── Rental ────────────────────────────────────────────────────────────────
  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalForm.subscriberId) { setAlertDialog({ message: 'Selecione um assinante.', variant: 'warning' }); return; }
    if (!rentalForm.motorcycleId) { setAlertDialog({ message: 'Selecione uma moto.', variant: 'warning' }); return; }
    if (!validatePositiveNumber(rentalForm.weeklyValue)) { setAlertDialog({ message: 'Valor semanal deve ser maior que zero.', variant: 'warning' }); return; }

    try {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + rentalForm.contractDurationMonths);
      const { contractDurationMonths, ...rentalData } = rentalForm;
      await createRental({ ...rentalData, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], isActive: true, outstandingBalance: 0, totalContractValue: 0, totalPaid: 0 });
      setView('LIST');
      setRentalForm({ subscriberId: '', motorcycleId: '', weeklyValue: 250, dueDayOfWeek: 1, contractDurationMonths: 12 });
    } catch (error) {
      console.error('Erro ao criar aluguel:', error);
      setAlertDialog({ message: 'Erro ao criar aluguel. Tente novamente.', variant: 'error' });
    }
  };

  const availableBikes = motorcycles.filter(m => m.status === MotorcycleStatus.AVAILABLE);

  const handleDeleteSubscriber = async (id: string) => {
    try {
      await deleteSubscriber(id);
    } catch (error: any) {
      setAlertDialog({ message: `Erro ao excluir assinante: ${error.message}`, variant: 'error', title: 'Erro ao excluir' });
    }
  };

  const handleTerminateRental = (rentalId: string, subscriberName: string, bikePlate: string) => {
    const rentalPayments = payments.filter(p => p.rentalId === rentalId);
    const totalPaid = rentalPayments.filter(p => p.status === PaymentStatus.PAID).reduce((sum, p) => sum + p.amount, 0);
    const totalExpected = rentalPayments.filter(p => p.status !== PaymentStatus.CANCELLED).reduce((sum, p) => sum + p.amount, 0);
    setTerminateReason('');
    setTerminatingRental({ rentalId, subscriberName, bikePlate, outstandingBalance: totalExpected - totalPaid });
  };

  const handleConfirmTerminate = async () => {
    if (!terminatingRental) return;
    setIsTerminating(true);
    try {
      await terminateRental(terminatingRental.rentalId, terminateReason.trim() || 'Rescisão de contrato');
      setTerminatingRental(null);
      setAlertDialog({ message: 'Contrato rescindido com sucesso! A moto foi liberada e os pagamentos futuros foram cancelados.', variant: 'success', title: 'Contrato Rescindido' });
    } catch (error: any) {
      setTerminatingRental(null);
      setAlertDialog({ message: `Erro ao rescindir contrato: ${error.message}`, variant: 'error' });
    } finally {
      setIsTerminating(false);
    }
  };

  return (
    <div className="space-y-6">
      <AlertDialog isOpen={!!alertDialog} message={alertDialog?.message ?? ''} variant={alertDialog?.variant} title={alertDialog?.title} onClose={() => setAlertDialog(null)} />

      <ConfirmDialog
        isOpen={!!terminatingRental}
        title="Rescindir Contrato"
        onConfirm={handleConfirmTerminate}
        onClose={() => setTerminatingRental(null)}
        confirmLabel={isTerminating ? 'Rescindindo...' : 'Rescindir'}
        confirmDisabled={isTerminating}
        cancelLabel="Cancelar"
        variant="danger"
      >
        {terminatingRental && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Rescindir contrato de <span className="font-semibold">{terminatingRental.subscriberName}</span> ({terminatingRental.bikePlate}).
            </p>
            {terminatingRental.outstandingBalance > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-semibold">Saldo devedor: {formatCurrency(terminatingRental.outstandingBalance)}</span>. Este valor continuará registrado após a rescisão.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da rescisão <span className="text-slate-400 font-normal">(opcional)</span></label>
              <textarea value={terminateReason} onChange={e => setTerminateReason(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder="Ex: Devolução antecipada, inadimplência..." />
            </div>
          </div>
        )}
      </ConfirmDialog>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Assinantes</h2>
          <p className="text-slate-500">Gestão de clientes e contratos.</p>
        </div>
        <button
          onClick={() => setView('NEW_SUB')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20"
        >
          <Plus size={18} /> Novo Assinante
        </button>
      </header>

      {view === 'LIST' && (
        <SubscriberGrid
          subscribers={subscribers}
          rentals={rentals}
          motorcycles={motorcycles}
          payments={payments}
          loading={loading}
          onEdit={handleEditClick}
          onDelete={handleDeleteSubscriber}
          onTerminateRental={handleTerminateRental}
        />
      )}

      {view === 'NEW_SUB' && (
        <div className="bg-white max-w-2xl mx-auto p-4 md:p-8 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Cadastrar Assinante</h3>
          <form onSubmit={handleCreateSubscriber} className="space-y-3">
            <SubscriberForm form={subForm} onChange={setSubForm} onCepBlur={handleCepBlur} onRealDriverCepBlur={handleRealDriverCepBlur} />
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => { setView('LIST'); setSubForm(emptySubForm()); }} className="px-6 py-2 text-slate-600 font-medium">
                Cancelar
              </button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        isOpen={isViewModalOpen}
        onClose={handleCloseModal}
        title={isEditing ? 'Editar Assinante' : 'Dados do Assinante'}
        maxWidth="2xl"
        headerAction={
          !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Pencil size={14} /> Editar
            </button>
          ) : undefined
        }
      >
        {isEditing ? (
          <form onSubmit={handleCreateSubscriber} className="space-y-3">
            <SubscriberForm
              form={subForm}
              onChange={setSubForm}
              onCepBlur={handleCepBlur}
              onRealDriverCepBlur={handleRealDriverCepBlur}
              isEdit
              subscriberId={editingSubscriber?.id}
              documents={documents}
              onDocumentUpload={handleDocumentUpload}
              onDocumentDelete={handleDocumentDelete}
              uploadLoading={uploadLoading}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Atualizar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <SubscriberView
              form={subForm}
              documents={documents}
              onDocumentDelete={handleDocumentDelete}
              onDocumentUpload={handleDocumentUpload}
              uploadLoading={uploadLoading}
              subscriberId={editingSubscriber?.id}
            />
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {view === 'NEW_RENTAL' && (
        <div className="bg-white max-w-2xl mx-auto p-4 md:p-8 rounded-xl shadow-sm border border-slate-100 animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-6">Novo Contrato de Aluguel</h3>
          <form onSubmit={handleCreateRental} className="space-y-5">
            <div>
              <label htmlFor="subscriber" className="block text-sm font-medium text-slate-700 mb-1">Assinante</label>
              <select id="subscriber" required value={rentalForm.subscriberId} onChange={e => setRentalForm({ ...rentalForm, subscriberId: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                <option value="">Selecione...</option>
                {subscribers.map(s => <option key={s.id} value={s.id}>{s.name} ({formatCPF(s.document)})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="motorcycle" className="block text-sm font-medium text-slate-700 mb-1">Moto Disponível</label>
              <select id="motorcycle" required value={rentalForm.motorcycleId} onChange={e => setRentalForm({ ...rentalForm, motorcycleId: e.target.value })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                <option value="">Selecione...</option>
                {availableBikes.map(m => <option key={m.id} value={m.id}>{m.model} - {m.plate}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="weeklyValue" className="block text-sm font-medium text-slate-700 mb-1">Valor Semanal (R$)</label>
                <input id="weeklyValue" required type="number" value={rentalForm.weeklyValue} onChange={e => setRentalForm({ ...rentalForm, weeklyValue: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg p-3" min={0} step={0.01} />
              </div>
              <div>
                <label htmlFor="dueDay" className="block text-sm font-medium text-slate-700 mb-1">Dia de Vencimento</label>
                <select id="dueDay" required value={rentalForm.dueDayOfWeek} onChange={e => setRentalForm({ ...rentalForm, dueDayOfWeek: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                  {WEEK_DAYS.map((day, idx) => <option key={idx} value={idx + 1}>{day}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">Duração do Contrato</label>
              <select id="duration" required value={rentalForm.contractDurationMonths} onChange={e => setRentalForm({ ...rentalForm, contractDurationMonths: Number(e.target.value) })} className="w-full border border-slate-300 rounded-lg p-3 bg-white">
                <option value={6}>6 meses</option>
                <option value={12}>1 ano (12 meses)</option>
                <option value={18}>18 meses</option>
                <option value={24}>2 anos (24 meses)</option>
                <option value={36}>3 anos (36 meses)</option>
              </select>
            </div>
            <div className="space-y-3">
              <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
                <Check className="shrink-0" size={20} />
                <p>Ao salvar, uma cobrança inicial será gerada automaticamente e o status da moto mudará para "Alugada".</p>
              </div>
              {rentalForm.weeklyValue > 0 && rentalForm.contractDurationMonths > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-sm font-semibold text-slate-700 mb-2">📊 Resumo do Contrato</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-500">Valor semanal:</span><p className="font-bold text-slate-800">R$ {rentalForm.weeklyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div><span className="text-slate-500">Valor mensal (aprox.):</span><p className="font-bold text-slate-800">R$ {(rentalForm.weeklyValue * 4.33).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                    <div><span className="text-slate-500">Duração:</span><p className="font-bold text-slate-800">{rentalForm.contractDurationMonths} meses</p></div>
                    <div><span className="text-slate-500">Total estimado:</span><p className="font-bold text-green-600">R$ {(rentalForm.weeklyValue * 4.33 * rentalForm.contractDurationMonths).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setView('LIST')} className="px-6 py-2 text-slate-600 font-medium">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium">Criar Aluguel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
