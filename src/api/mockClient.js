/**
 * Mock API client for agentBANK.
 * Mirrors the same interface as client.js but uses the local mock functions
 * from src/mock/api.js instead of real HTTP requests.
 *
 * Adds a simulated network delay to make it feel realistic in demos.
 */

import { mockApi, defaultBody } from '../mock/api.js';

const MIN_DELAY_MS = 180;
const MAX_DELAY_MS = 600;

function simulateDelay() {
  const ms = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock version of apiFetch — same signature as the real client.
 * @param {string} method
 * @param {string} path
 * @param {object|null} body
 * @param {string} token - Ignored in mock mode
 * @returns {Promise<object>}
 */
export async function apiFetch(method, path, body = null, token = '') {
  await simulateDelay();
  return mockApi(method, path);
}

/**
 * Re-export defaultBody so ToolConsolePage can still use it.
 */
export { defaultBody };
