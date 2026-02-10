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
 * Format plate to uppercase with hyphen (supports both old and Mercosul formats)
 * Old format: ABC-1234
 * Mercosul format: ABC1D23 (no hyphen)
 */
export const formatPlate = (plate: string): string => {
  const cleaned = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  if (cleaned.length >= 7) {
    // Check if it's Mercosul format (3 letters + 1 number + 1 letter + 2 numbers)
    const mercosulMatch = cleaned.match(/^([A-Z]{3})(\d{1})([A-Z]{1})(\d{2})$/);
    if (mercosulMatch) {
      return `${mercosulMatch[1]}${mercosulMatch[2]}${mercosulMatch[3]}${mercosulMatch[4]}`;
    }

    // Old format (3 letters + 4 numbers)
    const oldMatch = cleaned.match(/^([A-Z]{3})(\d{4})$/);
    if (oldMatch) {
      return `${oldMatch[1]}-${oldMatch[2]}`;
    }
  }

  return cleaned;
};
