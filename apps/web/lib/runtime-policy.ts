export function isStrictProdPolicyEnabled(): boolean {
  if (process.env.PROD_STRICT_POLICY === 'false') {
    return false;
  }
  if (process.env.PROD_STRICT_POLICY === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'production';
}
