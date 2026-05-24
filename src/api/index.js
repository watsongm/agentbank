import { apiFetch as realFetch } from './client.js';
import { apiFetch as mockFetch, defaultBody as mockDefaultBody } from './mockClient.js';

const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

export const apiFetch = useMock ? mockFetch : realFetch;
export const defaultBody = mockDefaultBody;
