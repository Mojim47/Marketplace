"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidateParams = exports.ValidateQuery = exports.ValidateBody = void 0;
const common_1 = require("@nestjs/common");
const zod_validation_pipe_1 = require("../pipes/zod-validation.pipe");
const ValidateBody = (schema) => (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schema));
exports.ValidateBody = ValidateBody;
const ValidateQuery = (schema) => (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schema));
exports.ValidateQuery = ValidateQuery;
const ValidateParams = (schema) => (0, common_1.UsePipes)(new zod_validation_pipe_1.ZodValidationPipe(schema));
exports.ValidateParams = ValidateParams;
//# sourceMappingURL=validate.decorator.js.map