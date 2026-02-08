export declare const QUEUE_NAMES: {
    readonly EMAIL: "email-queue";
    readonly SMS: "sms-queue";
    readonly IMAGE_PROCESS: "image-processing-queue";
    readonly AR_GENERATION: "ar-generation-queue";
    readonly CONTENT_PROCESSING: "content-processing-queue";
    readonly EMBEDDING_GENERATION: "embedding-generation-queue";
};
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
//# sourceMappingURL=queue.constants.d.ts.map