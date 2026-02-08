"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var QueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const config_1 = require("@nestjs/config");
let QueueService = QueueService_1 = class QueueService {
    constructor(configService) {
        Object.defineProperty(this, "configService", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: configService
        });
        Object.defineProperty(this, "logger", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new common_1.Logger(QueueService_1.name)
        });
        Object.defineProperty(this, "queues", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "workers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    async addJob(queueName, jobName, data, options) {
        const queue = this.getQueue(queueName);
        return await queue.add(jobName, data, options);
    }
    getQueue(queueName) {
        if (!this.queues.has(queueName)) {
            const queue = new bullmq_1.Queue(queueName, {
                connection: {
                    host: this.configService.get('REDIS_HOST', 'localhost'),
                    port: this.configService.get('REDIS_PORT', 6379),
                },
            });
            this.queues.set(queueName, queue);
        }
        return this.queues.get(queueName);
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = QueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QueueService);
//# sourceMappingURL=queue.service.js.map