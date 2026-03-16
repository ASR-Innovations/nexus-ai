-- Migration: Create timelock_operations table
-- This table stores timelock operations for security-enhanced contracts

CREATE TABLE IF NOT EXISTS timelock_operations (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    execute_at TIMESTAMP NOT NULL,
    executed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    parameters JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_by VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_timelock_operations_status ON timelock_operations(status);
CREATE INDEX IF NOT EXISTS idx_timelock_operations_execute_at ON timelock_operations(execute_at);
CREATE INDEX IF NOT EXISTS idx_timelock_operations_type ON timelock_operations(type);
CREATE INDEX IF NOT EXISTS idx_timelock_operations_created_by ON timelock_operations(created_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timelock_operations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_timelock_operations_updated_at
    BEFORE UPDATE ON timelock_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_timelock_operations_updated_at();