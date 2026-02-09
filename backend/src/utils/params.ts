/**
 * Helper to safely extract string from route params
 * Express params can be string | string[], this ensures we get a single string
 */
export const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) {
    return param[0] || '';
  }
  return param || '';
};
