/**
 * Authentication Configuration for Development Mode
 * 
 * This file is used ONLY in development/Figma Make environments
 * where the backend API is not available.
 * 
 * In production (Vercel), the app uses JWT authentication with
 * server-side validation via environment variables.
 */

export const AUTH_CONFIG = {
  /**
   * Development password for Figma Make testing
   * Change this to whatever password you want to use
   */
  DEV_PASSWORD: 'Screndly2025!SecurePass',
  
  /**
   * Enable development mode
   * Set to false to require backend API
   */
  ENABLE_DEV_MODE: true,
};
