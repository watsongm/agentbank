/**
 * Mock API client for agentBANK.
 * Mirrors the same interface as client.js but uses the local mock functions
 * from src/mock/api.js instead of real HTTP requests.
 *
 * Adds a simulated network delay to make it feel realistic in demos.
 */

import { mockApi, defaultBody, resolveEndpointPath } from '../mock/api.js';

const MIN_DELAY_MS = 180;
const MAX_DELAY_MS = 600;

function simulateDelay() {
  const ms = Math.round(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
  return new Promise(resolve => setTimeout(() => resolve(ms), ms));
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
 * Execute a mock request for the interactive console, returning status metadata and latency.
 */
export async function mockConsoleRequest(method, path, body = null, token = '') {
  const fapiId = crypto.randomUUID();
  const t0 = Date.now();
  await simulateDelay();
  const latencyMs = Date.now() - t0;
  const data = mockApi(method, path);
  const isCreated = method === 'POST' && /initiate|register|domestic-payments|international-payments|webhook/.test(path);
  const status = isCreated ? 201 : 200;
  const statusText = isCreated ? 'Created' : 'OK';
  return {
    data,
    status,
    statusText,
    latencyMs,
    ok: true,
    fapiId,
  };
}

/**
 * Re-export defaultBody and resolveEndpointPath so callers can use them from api/index.js.
 */
export { defaultBody, resolveEndpointPath };
