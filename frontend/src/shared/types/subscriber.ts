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
}
