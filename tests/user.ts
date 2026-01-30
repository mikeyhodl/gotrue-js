import { Buffer } from 'buffer';

import { test, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Token } from '../src/user';
import User from '../src/user';

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

// Mock TextDecoder for Node environment
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

const createValidToken = (exp: number): Token => ({
  access_token: `header.${Buffer.from(JSON.stringify({ exp })).toString('base64')}.secret`,
  expires_at: exp * 1000,
  expires_in: 3600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
});

const mockApi = {
  apiURL: 'https://example.com/.netlify/identity',
  defaultHeaders: {},
  request: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

afterEach(() => {
  User.removeSavedSession();
});

test('should parse token expiry from JWT claims', () => {
  const tokenResponse = {
    access_token:
      'header.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjEwMDB9.secret',
    expires_in: 3600,
    refresh_token: 'refresh',
    token_type: 'bearer' as const,
  };
  const user = new User(mockApi, tokenResponse, '');

  expect(user.token.expires_at).toBe(1_000_000);
});

test('should not log token on parsing error', () => {
  const errorSpy = vi.spyOn(console, 'error');
  const tokenResponse = {
    access_token: 'header.invalid.secret',
    expires_in: 3600,
    refresh_token: 'refresh',
    token_type: 'bearer' as const,
  };

  new User(mockApi, tokenResponse, '');

  expect(errorSpy).toHaveBeenCalledOnce();
  const [[error]] = errorSpy.mock.calls;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).not.toContain(tokenResponse.access_token);
});

test('should store audience', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, 'my-audience');

  expect(user.audience).toBe('my-audience');
});

test('should save and recover session from localStorage', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, 'test-audience');
  user.id = 'user-123';
  user.email = 'test@example.com';

  user._saveSession();

  expect(localStorageMock.setItem).toHaveBeenCalled();
  const savedData = JSON.parse(localStorageMock.store['gotrue.user']);
  expect(savedData.id).toBe('user-123');
  expect(savedData.email).toBe('test@example.com');
});

test('should return null when no session in localStorage', () => {
  // Clear any existing currentUser by creating and clearing a session
  const token = createValidToken(Date.now() / 1000 + 3600);
  const tempUser = new User(mockApi, token, '');
  tempUser.clearSession();

  // Now localStorage is empty and currentUser is null
  const recovered = User.recoverSession(mockApi);

  expect(recovered).toBeNull();
});

test('tokenDetails should return current token', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, '');

  const details = user.tokenDetails();

  expect(details.access_token).toBe(token.access_token);
  expect(details.refresh_token).toBe(token.refresh_token);
});

test('clearSession should remove saved session and null token', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, '');
  user._saveSession();

  user.clearSession();

  expect(localStorageMock.removeItem).toHaveBeenCalledWith('gotrue.user');
  expect(user.token).toBeNull();
});

test('jwt should return access_token when not expired', async () => {
  const futureExp = Date.now() / 1000 + 3600;
  const token = createValidToken(futureExp);
  const user = new User(mockApi, token, '');

  const jwt = await user.jwt();

  expect(jwt).toBe(token.access_token);
});

test('jwt should reject when token is null', async () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, '');
  user.token = null as unknown as Token;

  await expect(user.jwt()).rejects.toThrow('failed getting jwt access token');
});

test('_saveUserData should copy attributes to user', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, '');

  user._saveUserData({
    id: 'user-456',
    email: 'new@example.com',
    role: 'admin',
    custom_field: 'custom_value',
  });

  expect(user.id).toBe('user-456');
  expect(user.email).toBe('new@example.com');
  expect(user.role).toBe('admin');
  expect(user.custom_field).toBe('custom_value');
});

test('_saveUserData should not overwrite protected attributes', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, 'original-audience');

  user._saveUserData({
    api: 'should-not-overwrite',
    token: 'should-not-overwrite',
    audience: 'should-not-overwrite',
  });

  expect(user.api).toBe(mockApi);
  expect(user.audience).toBe('original-audience');
});

test('admin getter should return Admin instance', () => {
  const token = createValidToken(Date.now() / 1000 + 3600);
  const user = new User(mockApi, token, '');

  const admin = user.admin;

  expect(admin).toBeDefined();
  expect(admin.constructor.name).toBe('Admin');
});
