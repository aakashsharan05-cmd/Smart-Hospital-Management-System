export const TOKEN_KEY = 'shms_token';
export const USER_KEY = 'shms_user';

/**
 * Returns the current auth JWT token from storage, or null if not set.
 */
export const getToken = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

/**
 * Persists the auth token in storage.
 */
export const setStoredToken = (token) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
};

/**
 * Clears auth token and user from storage.
 */
export const removeStoredAuth = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  } catch {
    // ignore storage errors
  }
};
