// iso27001:A.12.4.1 | fata:1404-07.art8 | data-residency:IR
import { webcrypto, randomUUID } from 'crypto';
import { PointsEscrow, EscrowRecord } from '../points-escrow.js';

const COFFEE_RATE = 1000; // points per coffee
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const cryptoApi: Crypto = (globalThis.crypto || webcrypto) as Crypto;

type TokenPayload = {
  accountId: string;
  points: number;
  issuedAt: number;
  nonce: string;
};

export type MintResult = {
  token: string;
  points: number;
};

export class LoyaltyMarketplaceService {
  private readonly keyPromise: Promise<CryptoKey>;
  private readonly escrow: PointsEscrow;

  constructor(secretSeed: string, escrow = new PointsEscrow()) {
    if (!secretSeed) throw new Error('کلید محرمانه الزامی است');
    this.keyPromise = this.deriveKey(secretSeed);
    this.escrow = escrow;
  }

  coffeesToPoints(coffees: number): number {
    if (coffees <= 0) throw new Error('حداقل یک قهوه لازم است');
    return coffees * COFFEE_RATE;
  }

  async mint(accountId: string, coffees: number): Promise<MintResult> {
    const points = this.coffeesToPoints(coffees);
    const payload: TokenPayload = {
      accountId,
      points,
      issuedAt: Date.now(),
      nonce: randomUUID(),
    };
    const token = await this.encryptPayload(payload);
    return { token, points };
  }

  async decrypt(token: string): Promise<TokenPayload> {
    const key = await this.keyPromise;
    const bytes = fromBase64(token);
    const iv = bytes.slice(0, 12);
    const cipher = bytes.slice(12);
    const decrypted = await cryptoApi.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(decoder.decode(decrypted)) as TokenPayload;
  }

  async redeem(token: string): Promise<{ accountId: string; points: number }> {
    const payload = await this.decrypt(token);
    return { accountId: payload.accountId, points: payload.points };
  }

  async openPeerToPeer(token: string, toAccount: string): Promise<EscrowRecord> {
    const payload = await this.decrypt(token);
    return this.escrow.open(payload.accountId, toAccount, payload.points);
  }

  async releasePeerToPeer(
    escrowId: string,
    validator: (record: EscrowRecord) => boolean
  ): Promise<EscrowRecord> {
    return this.escrow.release(escrowId, validator);
  }

  async encryptPayload(payload: TokenPayload): Promise<string> {
    const key = await this.keyPromise;
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const cipher = await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(payload))
    );
    return toBase64(concatBuffers(iv.buffer, cipher));
  }

  private async deriveKey(seed: string): Promise<CryptoKey> {
    const digest = await cryptoApi.subtle.digest('SHA-256', encoder.encode(seed));
    return cryptoApi.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
}

function concatBuffers(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
}

function toBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(value, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
