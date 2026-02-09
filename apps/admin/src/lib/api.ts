const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export function buildApiUrl(path: string) {
  if (!path) {
    return API_BASE;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
}
