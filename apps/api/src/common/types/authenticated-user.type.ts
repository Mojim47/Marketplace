export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  mobile?: string | null;
  role?: string;
  roles?: string[];
  tenantId?: string | null;
  vendorId?: string | null;
  isActive?: boolean;
  isBanned?: boolean;
  firstName?: string | null;
  lastName?: string | null;
}
