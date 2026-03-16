/**
 * Migration: Create timelock_operations table
 * 
 * Creates the table for storing timelock operations with 2-day delays
 * for critical contract changes.
 */

exports.up = async function(knex) {
  return knex.schema.createTable('timelock_operations', function(table) {
    // Primary key
    table.string('id').primary();
    
    // Operation details
    table.enum('type', [
      'INTENT_VAULT_CHANGE',
      'AGENT_REGISTRY_CHANGE', 
      'EXECUTION_MANAGER_CHANGE'
    ]).notNullable();
    
    // Timing information
    table.timestamp('scheduled_at').notNullable();
    table.timestamp('execute_at').notNullable();
    table.timestamp('executed_at').nullable();
    table.timestamp('cancelled_at').nullable();
    
    // Operation data
    table.json('parameters').notNullable();
    
    // Status tracking
    table.enum('status', [
      'PENDING',
      'READY', 
      'EXECUTED',
      'CANCELLED',
      'FAILED'
    ]).notNullable().defaultTo('PENDING');
    
    // Metadata
    table.string('created_by').notNullable();
    table.string('transaction_hash').nullable();
    table.text('error_message').nullable();
    
    // Timestamps
    table.string('created_at').notNullable();
    table.string('updated_at').notNullable();
    
    // Indexes for efficient queries
    table.index(['status']);
    table.index(['type']);
    table.index(['execute_at']);
    table.index(['created_by']);
    table.index(['status', 'execute_at']); // Composite index for ready operations
  });
};

exports.down = async function(knex) {
  return knex.schema.dropTableIfExists('timelock_operations');
};