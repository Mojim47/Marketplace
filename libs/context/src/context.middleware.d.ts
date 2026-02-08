import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ContextService } from './context.service';
interface AuthenticatedUser {
    id: string;
    tenant_id: string;
    email: string;
    roles: string[];
    is_active: boolean;
}
interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}
export declare class ContextMiddleware implements NestMiddleware {
    private readonly contextService;
    private readonly logger;
    constructor(contextService: ContextService);
    use(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
    private extractTenantId;
    private getClientIp;
}
export {};
//# sourceMappingURL=context.middleware.d.ts.map