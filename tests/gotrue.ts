import { Buffer } from 'buffer';

import { test, expect, vi, beforeEach } from 'vitest';

import GoTrue from '../src/index';
import User from '../src/user';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window and localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

class MockTextDecoder {
  decode(bytes: Uint8Array): string {
    return String.fromCharCode(...bytes);
  }
}

global.window = {
  atob: (base64: string) => Buffer.from(base64, 'base64').toString('binary'),
  localStorage: localStorageMock,
  TextDecoder: MockTextDecoder,
} as unknown as Window & typeof globalThis;

global.localStorage = localStorageMock as unknown as Storage;
global.TextDecoder = MockTextDecoder as unknown as typeof TextDecoder;

const createMockResponse = (options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  body?: unknown;
}): Response => {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    contentType = 'application/json',
    body = {},
  } = options;

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => (name === 'Content-Type' ? contentType : null),
    },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
};

const createTokenResponse = (exp: number = Date.now() / 1000 + 3600) => ({
  access_token: `header.${Buffer.from(JSON.stringify({ exp })).toString('base64')}.secret`,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  User.removeSavedSession();
});

// Constructor tests
test('should use default API URL', () => {
  const auth = new GoTrue();

  expect(auth.api.apiURL).toBe('/.netlify/identity');
});

test('should use custom API URL', () => {
  const auth = new GoTrue({ APIUrl: 'https://custom.example.com/identity' });

  expect(auth.api.apiURL).toBe('https://custom.example.com/identity');
});

test('should warn when using HTTP', () => {
  const warnSpy = vi.spyOn(console, 'warn');

  new GoTrue({ APIUrl: 'http://insecure.example.com' });

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('DO NOT USE HTTP'));
});

test('should not warn when using HTTPS', () => {
  const warnSpy = vi.spyOn(console, 'warn');

  new GoTrue({ APIUrl: 'https://secure.example.com' });

  expect(warnSpy).not.toHaveBeenCalled();
});

test('should set audience when provided', () => {
  const auth = new GoTrue({ audience: 'my-app' });

  expect(auth.audience).toBe('my-app');
});

test('should set setCookie option', () => {
  const auth = new GoTrue({ setCookie: true });

  expect(auth.setCookie).toBe(true);
});

// settings() tests
test('settings should fetch from /settings endpoint', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  const settingsResponse = {
    autoconfirm: false,
    disable_signup: false,
    external: {
      bitbucket: false,
      email: true,
      facebook: false,
      github: true,
      gitlab: false,
      google: true,
    },
  };
  mockFetch.mockResolvedValue(createMockResponse({ body: settingsResponse }));

  const settings = await auth.settings();

  expect(mockFetch).toHaveBeenCalledWith('https://example.com/settings', expect.any(Object));
  expect(settings).toEqual(settingsResponse);
});

// signup() tests
test('signup should POST to /signup with email and password', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  mockFetch.mockResolvedValue(
    createMockResponse({
      body: { id: 'user-123', email: 'test@example.com' },
    }),
  );

  await auth.signup('test@example.com', 'password123');

  expect(mockFetch).toHaveBeenCalledWith(
    'https://example.com/signup',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        data: undefined,
      }),
    }),
  );
});

test('signup should include custom data when provided', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  mockFetch.mockResolvedValue(createMockResponse({ body: {} }));

  await auth.signup('test@example.com', 'password123', { name: 'Test User' });

  expect(mockFetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        data: { name: 'Test User' },
      }),
    }),
  );
});

// loginExternalUrl() tests
test('loginExternalUrl should return correct OAuth URL', () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com/.netlify/identity' });

  const url = auth.loginExternalUrl('github');

  expect(url).toBe('https://example.com/.netlify/identity/authorize?provider=github');
});

// acceptInviteExternalUrl() tests
test('acceptInviteExternalUrl should return URL with invite token', () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com/.netlify/identity' });

  const url = auth.acceptInviteExternalUrl('google', 'invite-token-123');

  expect(url).toBe(
    'https://example.com/.netlify/identity/authorize?provider=google&invite_token=invite-token-123',
  );
});

// requestPasswordRecovery() tests
test('requestPasswordRecovery should POST to /recover', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  mockFetch.mockResolvedValue(createMockResponse({ body: {} }));

  await auth.requestPasswordRecovery('test@example.com');

  expect(mockFetch).toHaveBeenCalledWith(
    'https://example.com/recover',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    }),
  );
});

// _setRememberHeaders() tests
test('_setRememberHeaders should set cookie header when setCookie is true', () => {
  const auth = new GoTrue({ setCookie: true });

  auth._setRememberHeaders(true);

  expect(auth.api.defaultHeaders['X-Use-Cookie']).toBe('1');
});

test('_setRememberHeaders should set session cookie when remember is false', () => {
  const auth = new GoTrue({ setCookie: true });

  auth._setRememberHeaders(false);

  expect(auth.api.defaultHeaders['X-Use-Cookie']).toBe('session');
});

test('_setRememberHeaders should not set header when setCookie is false', () => {
  const auth = new GoTrue({ setCookie: false });

  auth._setRememberHeaders(true);

  expect(auth.api.defaultHeaders['X-Use-Cookie']).toBeUndefined();
});

// _request with audience tests
test('_request should include X-JWT-AUD header when audience is set', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com', audience: 'my-app' });
  mockFetch.mockResolvedValue(createMockResponse({ body: {} }));

  await auth._request('/test');

  expect(mockFetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({
        'X-JWT-AUD': 'my-app',
      }),
    }),
  );
});

// currentUser() tests
test('currentUser should return null when no session exists', () => {
  const auth = new GoTrue();

  const user = auth.currentUser();

  expect(user).toBeNull();
});

// verify() tests
test('verify should POST to /verify with type and token', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  const tokenResponse = createTokenResponse();

  // First call for /verify, second for /user
  mockFetch
    .mockResolvedValueOnce(createMockResponse({ body: tokenResponse }))
    .mockResolvedValueOnce(
      createMockResponse({
        body: { id: 'user-123', email: 'test@example.com' },
      }),
    );

  await auth.verify('signup', 'confirmation-token');

  expect(mockFetch).toHaveBeenCalledWith(
    'https://example.com/verify',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'confirmation-token', type: 'signup' }),
    }),
  );
});

// Error handling tests
test('_request should enhance JSONHTTPError with msg field', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  mockFetch.mockResolvedValue(
    createMockResponse({
      ok: false,
      status: 400,
      body: { msg: 'User already exists' },
    }),
  );

  await expect(auth._request('/signup')).rejects.toThrow('User already exists');
});

test('_request should enhance JSONHTTPError with error and error_description', async () => {
  const auth = new GoTrue({ APIUrl: 'https://example.com' });
  mockFetch.mockResolvedValue(
    createMockResponse({
      ok: false,
      status: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid credentials' },
    }),
  );

  await expect(auth._request('/token')).rejects.toThrow('invalid_grant: Invalid credentials');
});
