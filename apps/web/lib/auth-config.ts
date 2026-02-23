export const AUTH_COOKIE_NAME = 'access_token';

export function getApiBaseUrl() {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

export type WebAuthUser = {
  id: string;
  email?: string | null;
  mobile: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
};

export type WebAuthResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: WebAuthUser;
};
