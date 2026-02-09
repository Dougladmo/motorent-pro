/**
 * Date utilities shared between frontend and backend
 */

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Get ISO date string (YYYY-MM-DD format)
 */
export const toISODate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Parse ISO date string to Date object (timezone-safe)
 */
export const parseISODate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Get today's date as ISO string
 */
export const getToday = (): string => {
  return toISODate(new Date());
};

/**
 * Compare two ISO date strings
 */
export const compareDates = (date1: string, date2: string): number => {
  return date1.localeCompare(date2);
};

/**
 * Check if date is in the past
 */
export const isPastDate = (date: string): boolean => {
  return compareDates(date, getToday()) < 0;
};

/**
 * Check if date is today
 */
export const isToday = (date: string): boolean => {
  return date === getToday();
};

/**
 * Check if date is in the future
 */
export const isFutureDate = (date: string): boolean => {
  return compareDates(date, getToday()) > 0;
};
