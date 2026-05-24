/**
 * Unified API entry point.
 * Exports the correct client based on VITE_USE_MOCK env var.
 *
 * When VITE_USE_MOCK is absent or 'true', the mock client is used.
 * When VITE_USE_MOCK='false', the real HTTP client is used.
 *
 * Both clients expose the same apiFetch(method, path, body, token) interface.
 * defaultBody is always sourced from mockClient (used by ToolConsolePage).
 */

export { apiFetch } from './mockClient.js';
export { defaultBody } from './mockClient.js';

// NOTE: To switch to the real backend, change the exports above to:
//   export { apiFetch } from './client.js';
// Or set VITE_USE_MOCK=false and use the conditional import pattern below.
