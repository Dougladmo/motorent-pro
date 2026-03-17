/**
 * Subscriber domain types
 */

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  email?: string;
  document: string;
  active: boolean;
  notes?: string;
  birthDate?: string;
  addressZip?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  isRealDriver: boolean;
  realDriverName?: string;
  realDriverDocument?: string;
  realDriverPhone?: string;
  realDriverRelationship?: string;
  realDriverAddressZip?: string;
  realDriverAddressStreet?: string;
  realDriverAddressNumber?: string;
  realDriverAddressComplement?: string;
  realDriverAddressNeighborhood?: string;
  realDriverAddressCity?: string;
  realDriverAddressState?: string;
}

export interface SubscriberDocument {
  id: string;
  subscriberId: string;
  fileName: string;
  fileUrl: string;
  fileType: 'contract' | 'cnh' | 'photo' | 'other';
  description?: string;
  createdAt: string;
}
