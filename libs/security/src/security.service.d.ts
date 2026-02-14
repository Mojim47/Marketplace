export declare class SecurityService {
  private readonly logger;
  checkAccess(
    context: {
      tenantId: string;
      userId?: string;
      roles: string[];
    },
    permission: string,
    resource: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }>;
  validateToken(token: string): Promise<boolean>;
}
//# sourceMappingURL=security.service.d.ts.map
