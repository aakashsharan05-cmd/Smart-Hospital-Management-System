describe('Frontend Auth Token Utility Tests', () => {
  let getToken;
  let setStoredToken;
  let removeStoredAuth;
  let TOKEN_KEY;
  let USER_KEY;

  beforeAll(async () => {
    // Mock global window and localStorage for Node.js environment
    const storage = {};
    global.window = {
      localStorage: {
        getItem: (k) => storage[k] ?? null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; },
        clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      },
    };

    const authModule = await import('../../frontend/src/utils/auth.js');
    getToken = authModule.getToken;
    setStoredToken = authModule.setStoredToken;
    removeStoredAuth = authModule.removeStoredAuth;
    TOKEN_KEY = authModule.TOKEN_KEY;
    USER_KEY = authModule.USER_KEY;
  });

  beforeEach(() => {
    if (global.window && global.window.localStorage) {
      global.window.localStorage.clear();
    }
  });

  afterAll(() => {
    delete global.window;
  });

  test('TOKEN_KEY is set to "shms_token"', () => {
    expect(TOKEN_KEY).toBe('shms_token');
    expect(USER_KEY).toBe('shms_user');
  });

  test('getToken returns null when no token is in localStorage', () => {
    expect(getToken()).toBeNull();
  });

  test('getToken reads specifically from "shms_token" key', () => {
    global.window.localStorage.setItem('shms_token', 'test-jwt-token-123');
    global.window.localStorage.setItem('token', 'wrong-key-token');

    expect(getToken()).toBe('test-jwt-token-123');
  });

  test('setStoredToken stores token under "shms_token"', () => {
    setStoredToken('new-token-456');
    expect(global.window.localStorage.getItem('shms_token')).toBe('new-token-456');
  });

  test('setStoredToken removes token if called with null/empty', () => {
    setStoredToken('existing-token');
    expect(getToken()).toBe('existing-token');
    setStoredToken(null);
    expect(getToken()).toBeNull();
  });

  test('removeStoredAuth clears both "shms_token" and "shms_user"', () => {
    global.window.localStorage.setItem('shms_token', 'active-token');
    global.window.localStorage.setItem('shms_user', JSON.stringify({ name: 'Test' }));

    removeStoredAuth();
    expect(global.window.localStorage.getItem('shms_token')).toBeNull();
    expect(global.window.localStorage.getItem('shms_user')).toBeNull();
  });
});
