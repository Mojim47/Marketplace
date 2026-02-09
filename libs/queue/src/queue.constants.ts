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
  MOODIAN_SUBMIT: 'moodian-submit',
  MOODIAN_SUBMIT_DLQ: 'moodian-submit-dlq',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
