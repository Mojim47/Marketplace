import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
export declare class QueueService {
    private readonly configService;
    private readonly logger;
    private queues;
    private workers;
    constructor(configService: ConfigService);
    addJob(queueName: string, jobName: string, data: any, options?: any): Promise<Job<any, any, string>>;
    private getQueue;
}
//# sourceMappingURL=queue.service.d.ts.map