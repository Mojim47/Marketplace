// ═══════════════════════════════════════════════════════════════════════════
// Queue Types
// ═══════════════════════════════════════════════════════════════════════════

export interface EmailJobData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  data?: Record<string, any>;
  attachments?: any[];
  replyTo?: string;
  cc?: string;
  bcc?: string;
}

export interface SmsJobData {
  to: string;
  message?: string;
  template?: string;
  params?: Record<string, string>;
}

export interface ImageProcessJobData {
  sourceKey: string;
  operations: Array<{
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill';
    format?: 'jpg' | 'png' | 'webp';
    quality?: number;
    suffix: string;
  }>;
}

export interface ARGenerationJobData {
  productId: string;
  modelData: any;
  outputFormat: 'glb' | 'usdz';
}

export interface ContentProcessingJobData {
  contentId: string;
  type: 'text' | 'image' | 'video';
  operations: string[];
}

export interface EmbeddingJobData {
  text: string;
  model: string;
  dimensions: number;
}