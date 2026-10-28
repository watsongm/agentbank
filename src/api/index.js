import { apiFetch as realFetch, realConsoleRequest } from './client.js';
import {
  apiFetch as mockFetch,
  mockConsoleRequest,
  defaultBody as mockDefaultBody,
  resolveEndpointPath as mockResolveEndpointPath,
} from './mockClient.js';

let currentMode = import.meta.env.VITE_USE_MOCK === 'false' ? 'live' : 'mock';

export function getApiMode() {
  return currentMode;
}

export function setApiMode(mode) {
  if (mode === 'mock' || mode === 'live') {
    currentMode = mode;
  }
  return currentMode;
}

export async function apiFetch(method, path, body = null, token = '', modeOverride = null) {
  const mode = modeOverride || currentMode;
  return mode === 'live'
    ? realFetch(method, path, body, token)
    : mockFetch(method, path, body, token);
}

export async function apiConsoleRequest(method, path, body = null, token = '', modeOverride = null) {
  const mode = modeOverride || currentMode;
  return mode === 'live'
    ? realConsoleRequest(method, path, body, token)
    : mockConsoleRequest(method, path, body, token);
}

export const defaultBody = mockDefaultBody;
export const resolveEndpointPath = mockResolveEndpointPath;
