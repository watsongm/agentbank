/**
 * Real API client for agentBANK.
 * Uses VITE_API_URL env var as base URL (fallback: http://localhost:3000).
 * Adds Authorization and x-fapi-interaction-id headers automatically.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Perform an authenticated API request.
 * @param {string} method - HTTP method (GET, POST, PUT, etc.)
 * @param {string} path - API path (e.g. /open-banking/v3.1/accounts)
 * @param {object|null} body - Request body (will be JSON-serialised)
 * @param {string} token - Bearer token
 * @returns {Promise<object>} Parsed JSON response
 * @throws {{ status: number, message: string }} On non-2xx response
 */
export async function apiFetch(method, path, body = null, token = '') {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-fapi-interaction-id': crypto.randomUUID(),
  };

  const options = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      message = errBody.message || errBody.error || message;
    } catch {
      // ignore parse errors
    }
    throw { status: response.status, message };
  }

  return response.json();
}
