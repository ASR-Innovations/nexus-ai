/**
 * Role-Based Access Control (RBAC) Service
 * Manages user roles, permissions, and access control for all operations
 */

import { Injectable, Logger } from '@nestjs/common';

export enum Role {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
  BOT = 'bot',
}

export enum Permission {
  // Wallet operations
  WALLET_CREATE = 'wallet:create',
  WALLET_READ = 'wallet:read',
  WALLET_SIGN = 'wallet:sign',
  WALLET_DELETE = 'wallet:delete',
  
  // Fund operations
  FUNDS_TRANSFER = 'funds:transfer',
  FUNDS_BRIDGE = 'funds:bridge',
  FUNDS_VIEW = 'funds:view',
  FUNDS_PAUSE = 'funds:pause',
  
  // Execution operations
  EXECUTION_START = 'execution:start',
  EXECUTION_STOP = 'execution:stop',
  EXECUTION_VIEW = 'execution:view',
  EXECUTION_ROLLBACK = 'execution:rollback',
  
  // Security operations
  SECURITY_CONFIG = 'security:config',
  SECURITY_VIEW = 'security:view',
  SECURITY_EMERGENCY = 'security:emergency',
  
  // System operations
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_ADMIN = 'system:admin',
}

export interface RoleDefinition {
  role: Role;
  permissions: Permission[];
  description: string;
}

export interface UserRole {
  address: string;
  role: Role;
  assignedAt: Date;
  assignedBy: string;
  expiresAt?: Date;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermission?: Permission;
  userRole?: Role;
}

@Injectable()
export class RBACService {
  private readonly logger = new Logger(RBACService.name);

  // Role definitions with permissions
  private readonly roleDefinitions: Map<Role, RoleDefinition> = new Map([
    [
      Role.ADMIN,
      {
        role: Role.ADMIN,
        permissions: [
          // All permissions
          Permission.WALLET_CREATE,
          Permission.WALLET_READ,
          Permission.WALLET_SIGN,
          Permission.WALLET_DELETE,
          Permission.FUNDS_TRANSFER,
          Permission.FUNDS_BRIDGE,
          Permission.FUNDS_VIEW,
          Permission.FUNDS_PAUSE,
          Permission.EXECUTION_START,
          Permission.EXECUTION_STOP,
          Permission.EXECUTION_VIEW,
          Permission.EXECUTION_ROLLBACK,
          Permission.SECURITY_CONFIG,
          Permission.SECURITY_VIEW,
          Permission.SECURITY_EMERGENCY,
          Permission.SYSTEM_CONFIG,
          Permission.SYSTEM_MONITOR,
          Permission.SYSTEM_ADMIN,
        ],
        description: 'Full system access with all permissions',
      },
    ],
    [
      Role.OPERATOR,
      {
        role: Role.OPERATOR,
        permissions: [
          Permission.WALLET_READ,
          Permission.WALLET_SIGN,
          Permission.FUNDS_TRANSFER,
          Permission.FUNDS_BRIDGE,
          Permission.FUNDS_VIEW,
          Permission.EXECUTION_START,
          Permission.EXECUTION_STOP,
          Permission.EXECUTION_VIEW,
          Permission.SECURITY_VIEW,
          Permission.SYSTEM_MONITOR,
        ],
        description: 'Operational access for executing transactions and monitoring',
      },
    ],
    [
      Role.VIEWER,
      {
        role: Role.VIEWER,
        permissions: [
          Permission.WALLET_READ,
          Permission.FUNDS_VIEW,
          Permission.EXECUTION_VIEW,
          Permission.SECURITY_VIEW,
          Permission.SYSTEM_MONITOR,
        ],
        description: 'Read-only access for monitoring and viewing',
      },
    ],
    [
      Role.BOT,
      {
        role: Role.BOT,
        permissions: [
          Permission.WALLET_READ,
          Permission.WALLET_SIGN,
          Permission.FUNDS_TRANSFER,
          Permission.FUNDS_BRIDGE,
          Permission.FUNDS_VIEW,
          Permission.EXECUTION_START,
          Permission.EXECUTION_VIEW,
        ],
        description: 'Automated bot access for executing approved operations',
      },
    ],
  ]);

  // User role assignments
  private userRoles: Map<string, UserRole> = new Map();

  // ============================================================================
  // Role Management
  // ============================================================================

  assignRole(address: string, role: Role, assignedBy: string, expiresAt?: Date): void {
    const userRole: UserRole = {
      address: address.toLowerCase(),
      role,
      assignedAt: new Date(),
      assignedBy,
      expiresAt,
    };

    this.userRoles.set(address.toLowerCase(), userRole);

    this.logger.log('Role assigned', {
      address,
      role,
      assignedBy,
      expiresAt: expiresAt?.toISOString(),
    });
  }

  revokeRole(address: string): void {
    this.userRoles.delete(address.toLowerCase());
    this.logger.log('Role revoked', { address });
  }

  getUserRole(address: string): UserRole | undefined {
    const userRole = this.userRoles.get(address.toLowerCase());

    // Check if role has expired
    if (userRole && userRole.expiresAt && new Date() > userRole.expiresAt) {
      this.revokeRole(address);
      return undefined;
    }

    return userRole;
  }

  hasRole(address: string, role: Role): boolean {
    const userRole = this.getUserRole(address);
    return userRole?.role === role;
  }

  // ============================================================================
  // Permission Checking
  // ============================================================================

  hasPermission(address: string, permission: Permission): boolean {
    const userRole = this.getUserRole(address);
    if (!userRole) {
      return false;
    }

    const roleDefinition = this.roleDefinitions.get(userRole.role);
    if (!roleDefinition) {
      return false;
    }

    return roleDefinition.permissions.includes(permission);
  }

  checkAccess(address: string, permission: Permission): AccessCheckResult {
    const userRole = this.getUserRole(address);

    if (!userRole) {
      return {
        allowed: false,
        reason: 'No role assigned to user',
        requiredPermission: permission,
      };
    }

    const roleDefinition = this.roleDefinitions.get(userRole.role);
    if (!roleDefinition) {
      return {
        allowed: false,
        reason: 'Invalid role definition',
        requiredPermission: permission,
        userRole: userRole.role,
      };
    }

    const hasPermission = roleDefinition.permissions.includes(permission);

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Role ${userRole.role} does not have permission ${permission}`,
        requiredPermission: permission,
        userRole: userRole.role,
      };
    }

    return {
      allowed: true,
      userRole: userRole.role,
    };
  }

  requirePermission(address: string, permission: Permission): void {
    const result = this.checkAccess(address, permission);
    if (!result.allowed) {
      throw new Error(`Access denied: ${result.reason}`);
    }
  }

  // ============================================================================
  // Role Information
  // ============================================================================

  getRolePermissions(role: Role): Permission[] {
    const roleDefinition = this.roleDefinitions.get(role);
    return roleDefinition?.permissions || [];
  }

  getRoleDefinition(role: Role): RoleDefinition | undefined {
    return this.roleDefinitions.get(role);
  }

  getAllRoles(): RoleDefinition[] {
    return Array.from(this.roleDefinitions.values());
  }

  listUserRoles(): UserRole[] {
    return Array.from(this.userRoles.values()).filter((userRole) => {
      // Filter out expired roles
      if (userRole.expiresAt && new Date() > userRole.expiresAt) {
        return false;
      }
      return true;
    });
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  assignRoleBulk(assignments: Array<{ address: string; role: Role; assignedBy: string }>): void {
    for (const assignment of assignments) {
      this.assignRole(assignment.address, assignment.role, assignment.assignedBy);
    }

    this.logger.log('Bulk role assignment completed', {
      count: assignments.length,
    });
  }

  revokeRoleBulk(addresses: string[]): void {
    for (const address of addresses) {
      this.revokeRole(address);
    }

    this.logger.log('Bulk role revocation completed', {
      count: addresses.length,
    });
  }

  // ============================================================================
  // Audit and Monitoring
  // ============================================================================

  getAccessLog(address?: string): Array<{
    timestamp: Date;
    address: string;
    permission: Permission;
    allowed: boolean;
    reason?: string;
  }> {
    // In production, this would query from a persistent audit log
    // For now, return empty array
    return [];
  }

  getRoleStatistics(): {
    totalUsers: number;
    byRole: Record<Role, number>;
    expiringSoon: number;
  } {
    const userRoles = this.listUserRoles();
    const byRole: Record<Role, number> = {
      [Role.ADMIN]: 0,
      [Role.OPERATOR]: 0,
      [Role.VIEWER]: 0,
      [Role.BOT]: 0,
    };

    let expiringSoon = 0;
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    for (const userRole of userRoles) {
      byRole[userRole.role]++;

      if (userRole.expiresAt && userRole.expiresAt <= sevenDaysFromNow) {
        expiringSoon++;
      }
    }

    return {
      totalUsers: userRoles.length,
      byRole,
      expiringSoon,
    };
  }
}
