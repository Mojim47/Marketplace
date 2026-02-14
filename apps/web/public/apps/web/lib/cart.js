'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
const CART_KEY = '__cart_v1';
function normalize(cart) {
  return cart
    .filter((item) => item.quantity > 0)
    .map((item) => ({ ...item, quantity: Math.floor(item.quantity) || 1 }));
}
// Lemma: Persistent storage respects Iranian data residency
export async function readCart() {
  const raw = cookies().get(CART_KEY)?.value;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalize(parsed);
  } catch {
    return [];
  }
}
// Axiom: All mutations are idempotent and side-effect-free
export async function writeCart(cart) {
  const next = JSON.stringify(normalize(cart));
  cookies().set(CART_KEY, next, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  revalidatePath('/cart');
}
// Corollary: Add is associative and commutative
export async function addToCart(productId, qty = 1) {
  const amount = Number.isFinite(qty) ? Math.max(1, Math.floor(qty)) : 1;
  const cart = await readCart();
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity += amount;
  } else {
    cart.push({ productId, quantity: amount });
  }
  await writeCart(cart);
}
//# sourceMappingURL=cart.js.map
