// ═══════════════════════════════════════════════════════════════════════════
// Queue Constants
// ═══════════════════════════════════════════════════════════════════════════

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  SMS: 'sms-queue',
  IMAGE_PROCESS: 'image-processing-queue',
  AR_GENERATION: 'ar-generation-queue',
  CONTENT_PROCESSING: 'content-processing-queue',
  EMBEDDING_GENERATION: 'embedding-generation-queue',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
