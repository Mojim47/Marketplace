let cached = null;
function validateUrl(u) {
  try {
    new URL(u);
    return u;
  } catch {
    throw new Error(`Invalid URL for NEXT_PUBLIC_API_BASE: ${u}`);
  }
}
export function getEnv() {
  if (cached) return cached;
  const NODE_ENV_RAW = process.env.NODE_ENV || 'development';
  const NODE_ENV = ['development', 'production', 'test'].includes(NODE_ENV_RAW)
    ? NODE_ENV_RAW
    : 'development';
  const NEXT_PUBLIC_API_BASE = validateUrl(
    process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'
  );
  cached = { NODE_ENV, NEXT_PUBLIC_API_BASE };
  return cached;
}
//# sourceMappingURL=env.js.map
