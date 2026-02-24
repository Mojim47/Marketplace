import { createHmac, timingSafeEqual } from 'node:crypto';

export const STORY_SESSION_COOKIE = 'ng_story_sid';
export const STORY_ATTR_COOKIE = 'ng_story_attr';
export const STORY_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const STORY_ATTR_MAX_AGE = 60 * 60 * 24 * 7;

const STORY_MEDIA_SIGNING_SECRET =
  process.env.STORY_MEDIA_SIGNING_SECRET || 'nextgen-story-signing-2026';

export function signStoryMediaPayload(url: string, exp: number): string {
  return createHmac('sha256', STORY_MEDIA_SIGNING_SECRET).update(`${url}.${exp}`).digest('hex');
}

export function verifyStoryMediaSignature(url: string, exp: number, signature: string): boolean {
  const expected = signStoryMediaPayload(url, exp);
  const left = Buffer.from(signature, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export type StoryAttribution = {
  storyId: string;
  vendorId: string;
  at: number;
};

export function encodeStoryAttribution(value: StoryAttribution): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeStoryAttribution(raw: string | undefined): StoryAttribution | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as StoryAttribution;
    if (
      typeof parsed.storyId !== 'string' ||
      typeof parsed.vendorId !== 'string' ||
      typeof parsed.at !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
