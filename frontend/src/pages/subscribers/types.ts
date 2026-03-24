import { SubscriberDocument } from '../../shared/types/subscriber';

export type SubFormState = {
  name: string;
  phone: string;
  document: string;
  email: string;
  notes: string;
  birthDate: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  isRealDriver: boolean;
  realDriverName: string;
  realDriverDocument: string;
  realDriverPhone: string;
  realDriverRelationship: string;
  realDriverAddressZip: string;
  realDriverAddressStreet: string;
  realDriverAddressNumber: string;
  realDriverAddressComplement: string;
  realDriverAddressNeighborhood: string;
  realDriverAddressCity: string;
  realDriverAddressState: string;
  autoRemindersEnabled: boolean;
};

export const emptySubForm = (): SubFormState => ({
  name: '', phone: '', document: '', email: '', notes: '',
  birthDate: '',
  addressZip: '', addressStreet: '', addressNumber: '', addressComplement: '',
  addressNeighborhood: '', addressCity: '', addressState: '',
  isRealDriver: true,
  realDriverName: '', realDriverDocument: '', realDriverPhone: '', realDriverRelationship: '',
  realDriverAddressZip: '', realDriverAddressStreet: '', realDriverAddressNumber: '',
  realDriverAddressComplement: '', realDriverAddressNeighborhood: '',
  realDriverAddressCity: '', realDriverAddressState: '',
  autoRemindersEnabled: true
});

export const FILE_TYPE_LABELS: Record<SubscriberDocument['fileType'], string> = {
  contract: 'Contrato',
  cnh: 'CNH',
  photo: 'Foto',
  other: 'Outro'
};

export const inputCls = "w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-600";

export async function fetchCep(cep: string) {
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

export const getMimeType = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

export const buildSubscriberPayload = (f: SubFormState) => ({
  name: f.name,
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
