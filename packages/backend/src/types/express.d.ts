/**
 * Express types override
 * Makes params always string to avoid string | string[] issues
 */

declare namespace Express {
  export interface Request {
    params: Record<string, string>;
  }
}
