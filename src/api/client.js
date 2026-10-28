/**
 * Real API client for agentBANK.
 * Uses VITE_API_URL env var as base URL (fallback: http://localhost:3000).
 * Adds Authorization and x-fapi-interaction-id headers automatically.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function normalizeAuthHeader(token = '') {
  const trimmed = String(token || '').trim();
  if (!trimmed) return 'Bearer demo-token';
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

/**
 * Perform an authenticated API request.
 * @param {string} method - HTTP method (GET, POST, PUT, etc.)
 * @param {string} path - API path (e.g. /open-banking/v3.1/accounts)
 * @param {object|null} body - Request body (will be JSON-serialised)
 * @param {string} token - Bearer token
 * @returns {Promise<object>} Parsed JSON response
 * @throws {{ status: number, message: string, data?: object }} On non-2xx response
 */
export async function apiFetch(method, path, body = null, token = '') {
  const fapiId = crypto.randomUUID();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': normalizeAuthHeader(token),
    'x-fapi-interaction-id': fapiId,
  };

  const options = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    let errBody = null;
    try {
      errBody = await response.json();
      message = errBody.message || errBody.error || message;
    } catch {
      // ignore parse errors
    }
    throw { status: response.status, message, data: errBody };
  }

  return response.json();
}

/**
 * Execute an API request for the interactive console, returning status metadata and latency.
 */
export async function realConsoleRequest(method, path, body = null, token = '') {
  const fapiId = crypto.randomUUID();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': normalizeAuthHeader(token),
    'x-fapi-interaction-id': fapiId,
  };

  const options = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const t0 = Date.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const latencyMs = Date.now() - t0;
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = { status: response.status, message: response.statusText };
    }
    const statusText = response.statusText || (response.status === 200 ? 'OK' : response.status === 201 ? 'Created' : response.status === 400 ? 'Bad Request' : response.status === 401 ? 'Unauthorized' : response.status === 404 ? 'Not Found' : 'Response');
    return {
      data,
      status: response.status,
      statusText,
      latencyMs,
      ok: response.ok,
      fapiId: response.headers.get('x-fapi-interaction-id') || fapiId,
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    return {
      data: {
        error: 'BackendUnreachable',
        message: err?.message || 'Failed to connect to live backend at ' + BASE_URL,
        hint: 'Start the Fastify backend on port 3000 or toggle to MOCK mode in the console header.',
      },
      status: 503,
      statusText: 'Service Unavailable',
      latencyMs,
      ok: false,
      fapiId,
    };
  }
}
