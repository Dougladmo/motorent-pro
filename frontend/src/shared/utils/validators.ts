/**
 * Validation utilities for Brazilian formats
 */

/**
 * Validate Brazilian CPF
 */
export const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');

  if (cleaned.length !== 11) return false;

  // Check for known invalid CPFs
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validate check digits
  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (11 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleaned.substring(i - 1, i)) * (12 - i);
  }

  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.substring(10, 11))) return false;

  return true;
};

/**
 * Validate Brazilian phone number
 */
export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
};

/**
 * Validate plate format (ABC-1234 or ABC1D23)
 */
export const validatePlate = (plate: string): boolean => {
  const cleaned = plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // Old format: ABC-1234
  const oldFormat = /^[A-Z]{3}\d{4}$/;
  // Mercosul format: ABC1D23
  const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  return oldFormat.test(cleaned) || mercosulFormat.test(cleaned);
};

/**
 * Validate year is within reasonable range
 */
export const validateYear = (year: number): boolean => {
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 1;
};

/**
 * Validate positive number
 */
export const validatePositiveNumber = (value: number): boolean => {
  return !isNaN(value) && value > 0;
};

/**
 * Validate Brazilian vehicle chassis number (VIN)
 * Must be exactly 17 alphanumeric characters (no I, O, Q)
 */
export const validateChassi = (chassi: string): boolean => {
  const cleaned = chassi.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
};

/**
 * Validate Brazilian RENAVAM number (11 digits)
 */
export const validateRenavam = (renavam: string): boolean => {
  const cleaned = renavam.replace(/\D/g, '');
  return cleaned.length === 11;
};
