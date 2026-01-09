import { Environment, DebugConfig } from '@air-clash/common';

/**
 * Client configuration loaded from environment variables
 */
export const clientConfig = {
  /**
   * Server WebSocket URL
   * Development: ws://localhost:3000
   * Production: wss://your-domain.com
   */
  serverUrl: import.meta.env.VITE_SERVER_URL || 'ws://localhost:3000',

  /**
   * Environment mode
   */
  environment: (import.meta.env.VITE_ENV || 'development') as Environment,

  /**
   * Debug configuration
   */
  debug: {
    showFPS: import.meta.env.VITE_DEBUG_FPS === 'true',
    showColliders: import.meta.env.VITE_DEBUG_COLLIDERS === 'true',
    verboseLogging: import.meta.env.VITE_DEBUG_VERBOSE === 'true',
  } as DebugConfig,

  /**
   * Check if running in production
   */
  isProduction: import.meta.env.MODE === 'production',

  /**
   * Check if running in development
   */
  isDevelopment: import.meta.env.MODE === 'development',
} as const;

// Log configuration on load (development only)
if (clientConfig.isDevelopment && clientConfig.debug.verboseLogging) {
  console.log('🔧 Client Configuration:', clientConfig);
}
