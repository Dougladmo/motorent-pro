/**
 * Subscriber domain types
 */

export interface Subscriber {
  id: string;
  name: string;
  phone: string;
  document: string;
  active: boolean;
  notes?: string;
}
