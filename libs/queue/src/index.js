"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultJobOptions = exports.getQueueConfig = exports.QueueModule = exports.QueueService = void 0;
var queue_service_1 = require("./queue.service");
Object.defineProperty(exports, "QueueService", { enumerable: true, get: function () { return queue_service_1.QueueService; } });
var queue_module_1 = require("./queue.module");
Object.defineProperty(exports, "QueueModule", { enumerable: true, get: function () { return queue_module_1.QueueModule; } });
var queue_config_1 = require("./queue.config");
Object.defineProperty(exports, "getQueueConfig", { enumerable: true, get: function () { return queue_config_1.getQueueConfig; } });
Object.defineProperty(exports, "getDefaultJobOptions", { enumerable: true, get: function () { return queue_config_1.getDefaultJobOptions; } });
__exportStar(require("./queue.types"), exports);
__exportStar(require("./queue.constants"), exports);
//# sourceMappingURL=index.js.map