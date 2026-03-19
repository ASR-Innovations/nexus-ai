# Security and Compliance Module

This module implements comprehensive security and compliance features for the autonomous agent system, including role-based access control, data encryption, HSM integration, and suspicious activity detection.

## Features

### 1. Role-Based Access Control (RBAC)

The RBAC system provides fine-grained access control for all operations.

#### Roles

- **Admin**: Full system access with all permissions
- **Operator**: Operational access for executing transactions and monitoring
- **Viewer**: Read-only access for monitoring and viewing
- **Bot**: Automated bot access for executing approved operations

#### Permissions

Permissions are organized by category:

**Wallet Operations**
- `wallet:create` - Create new wallets
- `wallet:read` - View wallet information
- `wallet:sign` - Sign transactions
- `wallet:delete` - Delete wallets

**Fund Operations**
- `funds:transfer` - Transfer funds
- `funds:bridge` - Bridge funds cross-chain
- `funds:view` - View fund information
- `funds:pause` - Pause fund movements

**Execution Operations**
- `execution:start` - Start executions
- `execution:stop` - Stop executions
- `execution:view` - View execution status
- `execution:rollback` - Rollback executions

**Security Operations**
- `security:config` - Configure security settings
- `security:view` - View security status
- `security:emergency` - Emergency controls

**System Operations**
- `system:config` - Configure system settings
- `system:monitor` - Monitor system health
- `system:admin` - System administration

#### API Endpoints

```bash
# Assign role to user
POST /security/rbac/assign
{
  "address": "0x...",
  "role": "operator",
  "assignedBy": "0x..."
}

# Revoke role
POST /security/rbac/revoke
{
  "address": "0x..."
}

# Check permission
POST /security/rbac/check
{
  "address": "0x...",
  "permission": "funds:transfer"
}

# Get user role
GET /security/rbac/user/:address

# Get all roles
GET /security/rbac/roles

# Get role statistics
GET /security/rbac/statistics
```

### 2. Data Encryption

The encryption service provides industry-standard encryption for sensitive data.

#### Features

- AES-256-GCM encryption
- Secure key derivation
- Data hashing with salt
- Object encryption/decryption

#### API Endpoints

```bash
# Encrypt data
POST /security/encryption/encrypt
{
  "plaintext": "sensitive data"
}

# Decrypt data
POST /security/encryption/decrypt
{
  "encrypted": "...",
  "iv": "...",
  "authTag": "..."
}

# Hash data
POST /security/encryption/hash
{
  "data": "data to hash"
}
```

#### Usage Example

```typescript
import { EncryptionService } from './shared/services/encryption.service';

// Encrypt data
const result = encryptionService.encrypt('sensitive data');
// Returns: { encrypted, iv, authTag }

// Decrypt data
const plaintext = encryptionService.decrypt(result);

// Hash data
const hash = encryptionService.hash('data');
```

### 3. HSM/KMS Integration

The HSM service provides secure key management and transaction signing using Hardware Security Modules or Key Management Services.

#### Supported Providers

- **AWS KMS**: Amazon Web Services Key Management Service
- **Azure Key Vault**: Microsoft Azure Key Vault
- **Local**: Local key management (development only)

#### Configuration

```env
# Enable HSM/KMS
KMS_ENABLED=true
KMS_PROVIDER=aws-kms  # or azure-keyvault, local
KMS_KEY_ID=your-key-id

# AWS KMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_KMS_KEY_ARN=...

# Azure Key Vault
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_KEY_VAULT_URL=...
```

#### API Endpoints

```bash
# Get HSM status
GET /security/hsm/status

# Sign transaction with HSM
POST /security/hsm/sign
{
  "transactionHash": "0x..."
}
```

#### Usage Example

```typescript
import { HSMService } from './shared/services/hsm.service';

// Sign transaction
const signature = await hsmService.signTransaction(txHash);

// Encrypt data with HSM
const encrypted = await hsmService.encryptData(plaintext);

// Decrypt data with HSM
const decrypted = await hsmService.decryptData(ciphertext);
```

### 4. Suspicious Activity Detection

The activity monitoring service detects suspicious patterns and automatically freezes operations when necessary.

#### Detection Patterns

- **High Frequency**: Unusually high transaction frequency
- **Large Amount**: Transactions exceeding threshold
- **Rapid Succession**: Multiple transactions in quick succession
- **Unusual Destination**: Transactions to blacklisted addresses
- **Blacklisted**: Address is on blacklist

#### Configuration

```env
# Activity monitoring thresholds
ACTIVITY_HIGH_FREQUENCY_THRESHOLD=10  # transactions per minute
ACTIVITY_LARGE_AMOUNT_THRESHOLD=100000000000000000000  # 100 tokens
ACTIVITY_RAPID_SUCCESSION_WINDOW=60000  # milliseconds
```

#### API Endpoints

```bash
# Get suspicious addresses
GET /security/activity/suspicious

# Get frozen accounts
GET /security/activity/frozen

# Freeze account
POST /security/activity/freeze
{
  "address": "0x...",
  "reason": "Suspicious activity detected",
  "frozenBy": "system"
}

# Unfreeze account
POST /security/activity/unfreeze
{
  "address": "0x..."
}

# Get blacklist
GET /security/activity/blacklist

# Add to blacklist
POST /security/activity/blacklist/add
{
  "address": "0x..."
}

# Remove from blacklist
POST /security/activity/blacklist/remove
{
  "address": "0x..."
}

# Get activity statistics
GET /security/activity/statistics

# Get activity history
GET /security/activity/:address/history?limit=100
```

#### Usage Example

```typescript
import { ActivityMonitorService } from './shared/services/activity-monitor.service';

// Monitor activity and auto-freeze if suspicious
const result = await activityMonitor.monitorAndFreeze(address, event);

if (result.frozen) {
  console.log('Account frozen due to suspicious activity');
  console.log('Risk score:', result.analysis.riskScore);
  console.log('Patterns:', result.analysis.patterns);
}

// Check if account is frozen
const isFrozen = activityMonitor.isFrozen(address);

// Get suspicious addresses
const suspicious = activityMonitor.getSuspiciousAddresses();
```

## Integration with Existing Services

The security module integrates with:

- **WalletManagerService**: Secure wallet access control
- **FundManagerService**: Transaction authorization
- **ExecutionEngine**: Operation permissions
- **ErrorHandlingService**: Security event logging

## Security Best Practices

1. **Always use RBAC**: Check permissions before executing sensitive operations
2. **Encrypt sensitive data**: Use encryption service for all sensitive data at rest
3. **Use HSM for production**: Enable HSM/KMS for production deployments
4. **Monitor activity**: Enable activity monitoring to detect suspicious patterns
5. **Regular audits**: Review security logs and frozen accounts regularly
6. **Update blacklist**: Keep blacklist updated with known malicious addresses
7. **Rotate keys**: Regularly rotate encryption keys and HSM keys

## Testing

```bash
# Run security tests
npm test -- security

# Run specific test suites
npm test -- rbac.service.spec.ts
npm test -- encryption.service.spec.ts
npm test -- hsm.service.spec.ts
npm test -- activity-monitor.service.spec.ts
```

## Monitoring

The security module provides comprehensive monitoring:

```bash
# Get security status
GET /security/status

# Get security metrics
GET /security/metrics

# Get security health
GET /security/health
```

## Emergency Procedures

### Account Freeze

If suspicious activity is detected:

1. Account is automatically frozen
2. All operations are blocked
3. Security alert is generated
4. Admin notification is sent

To unfreeze:

```bash
POST /security/activity/unfreeze
{
  "address": "0x..."
}
```

### Emergency Pause

To pause all fund movements:

```bash
# This would be implemented in the contract layer
# For now, use the activity monitoring to freeze specific accounts
```

## Compliance

The security module supports compliance requirements:

- **Audit Logging**: All security events are logged
- **Access Control**: RBAC ensures proper authorization
- **Data Protection**: Encryption protects sensitive data
- **Activity Monitoring**: Detects and prevents suspicious activity
- **Regulatory Reporting**: Audit logs support regulatory reporting

## Future Enhancements

- [ ] Multi-factor authentication (MFA)
- [ ] Biometric authentication
- [ ] Advanced anomaly detection using ML
- [ ] Integration with external threat intelligence
- [ ] Automated incident response
- [ ] Compliance reporting automation
