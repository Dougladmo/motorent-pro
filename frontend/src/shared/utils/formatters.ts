/**
 * Formatting utilities for Brazilian locale
 */

/**
 * Format currency in BRL
 */
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

/**
 * Format date to Brazilian locale
 */
export const formatDate = (date: string | Date): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('pt-BR');
};

/**
 * Format phone number to Brazilian format
 */
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return phone;
};

/**
 * Format CPF document
 */
export const formatCPF = (cpf: string): string => {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  return cpf;
};

/**
 * Format plate to uppercase with progressive formatting (supports both old and Mercosul formats)
 * Old format: ABC-1234
 * Mercosul format: ABC1D23 (no hyphen)
 */
export const formatPlate = (plate: string): string => {
  const cleaned = plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  if (cleaned.length <= 3) {
    return cleaned.replace(/[^A-Z]/g, '').substring(0, 3);
  }

  const prefix = cleaned.substring(0, 3).replace(/[^A-Z]/g, '');
  if (prefix.length < 3) return prefix;

  const rest = cleaned.substring(3);
  const char4 = rest[0];

  // 4th character must be a digit
  if (!char4 || !/\d/.test(char4)) return prefix;

  if (rest.length === 1) {
    return `${prefix}${char4}`;
  }

  const char5 = rest[1];

  if (/[A-Z]/.test(char5)) {
    // Mercosul format: ABC-1D23 (with hyphen)
    const remaining = rest.substring(2).replace(/[^0-9]/g, '').substring(0, 2);
    return `${prefix}-${char4}${char5}${remaining}`;
  } else if (/\d/.test(char5)) {
    // Old format: ABC-1234
    const digits = (char4 + rest.substring(1).replace(/[^0-9]/g, '')).substring(0, 4);
    return `${prefix}-${digits}`;
  }

  return `${prefix}${char4}`;
};

/**
 * Capitalize each word of a name (first letter uppercase, rest lowercase)
 */
export const capitalizeName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
};
