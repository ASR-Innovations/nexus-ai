/**
 * Migration: Create Bot Configuration and Monitoring Tables
 * 
 * This migration creates tables for:
 * - Agent bot configurations
 * - Bot execution logs and monitoring
 * - Bot performance metrics
 */

exports.up = async function(knex) {
  console.log('Creating bot configuration and monitoring tables...');

  // Agent Bot Configurations Table
  await knex.schema.createTable('agent_bot_configs', function(table) {
    table.string('address', 42).primary().comment('Agent wallet address');
    table.string('name', 100).notNullable().comment('Bot display name');
    table.json('specialties').notNullable().comment('Array of bot specialties');
    table.enum('risk_tolerance', ['low', 'medium', 'high']).defaultTo('medium');
    table.integer('max_active_intents').defaultTo(5);
    table.integer('min_reputation_threshold').defaultTo(3000);
    table.boolean('auto_execute').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.bigInteger('created_at').notNullable();
    table.bigInteger('updated_at').notNullable();
    
    table.index(['is_active']);
    table.index(['risk_tolerance']);
  });

  // Bot Execution Logs Table
  await knex.schema.createTable('bot_execution_logs', function(table) {
    table.increments('id').primary();
    table.integer('intent_id').notNullable().comment('Intent ID being executed');
    table.string('agent_address', 42).notNullable().comment('Agent executing the intent');
    table.enum('status', [
      'claimed', 
      'plan_submitted', 
      'approved', 
      'executing', 
      'completed', 
      'failed',
      'cancelled'
    ]).notNullable();
    table.bigInteger('created_at').notNullable().comment('When execution started');
    table.bigInteger('updated_at').notNullable().comment('Last status update');
    table.bigInteger('completed_at').nullable().comment('When execution finished');
    table.string('gas_used', 50).nullable().comment('Total gas used in wei');
    table.json('transaction_hashes').nullable().comment('Array of transaction hashes');
    table.text('error_message').nullable().comment('Error details if failed');
    table.json('execution_plan').nullable().comment('Stored execution plan');
    table.integer('step_count').nullable().comment('Total number of steps');
    table.integer('completed_steps').nullable().comment('Number of completed steps');
    
    table.unique(['intent_id']); // One execution per intent
    table.index(['agent_address']);
    table.index(['status']);
    table.index(['created_at']);
    table.foreign('agent_address').references('address').inTable('agent_bot_configs');
  });

  // Bot Performance Metrics Table
  await knex.schema.createTable('bot_performance_metrics', function(table) {
    table.increments('id').primary();
    table.string('agent_address', 42).notNullable();
    table.string('metric_name', 50).notNullable().comment('Name of the metric');
    table.string('metric_value', 100).notNullable().comment('Value as string to handle big numbers');
    table.bigInteger('recorded_at').notNullable().comment('When metric was recorded');
    table.string('period', 20).defaultTo('daily').comment('Aggregation period');
    
    table.index(['agent_address', 'metric_name']);
    table.index(['recorded_at']);
    table.foreign('agent_address').references('address').inTable('agent_bot_configs');
  });

  // Bot Monitoring Events Table
  await knex.schema.createTable('bot_monitoring_events', function(table) {
    table.increments('id').primary();
    table.string('agent_address', 42).notNullable();
    table.string('event_type', 50).notNullable().comment('Type of monitoring event');
    table.enum('severity', ['info', 'warning', 'error', 'critical']).defaultTo('info');
    table.string('message', 500).notNullable().comment('Event message');
    table.json('event_data').nullable().comment('Additional event data');
    table.bigInteger('created_at').notNullable();
    table.boolean('acknowledged').defaultTo(false);
    table.bigInteger('acknowledged_at').nullable();
    
    table.index(['agent_address']);
    table.index(['event_type']);
    table.index(['severity']);
    table.index(['created_at']);
    table.foreign('agent_address').references('address').inTable('agent_bot_configs');
  });

  // Bot Strategy Performance Table
  await knex.schema.createTable('bot_strategy_performance', function(table) {
    table.increments('id').primary();
    table.string('agent_address', 42).notNullable();
    table.string('strategy_type', 50).notNullable().comment('liquid_staking, yield_farming, arbitrage');
    table.string('protocol', 50).notNullable().comment('Protocol used');
    table.string('chain', 50).notNullable().comment('Blockchain/parachain');
    table.integer('executions_count').defaultTo(0);
    table.integer('successful_executions').defaultTo(0);
    table.string('total_volume', 50).defaultTo('0').comment('Total volume processed in wei');
    table.string('total_fees_earned', 50).defaultTo('0').comment('Total fees earned in wei');
    table.string('total_gas_used', 50).defaultTo('0').comment('Total gas used in wei');
    table.decimal('average_execution_time', 10, 2).defaultTo(0).comment('Average execution time in seconds');
    table.decimal('success_rate', 5, 2).defaultTo(0).comment('Success rate percentage');
    table.bigInteger('last_execution_at').nullable();
    table.bigInteger('created_at').notNullable();
    table.bigInteger('updated_at').notNullable();
    
    table.unique(['agent_address', 'strategy_type', 'protocol', 'chain']);
    table.index(['strategy_type']);
    table.index(['protocol']);
    table.index(['success_rate']);
    table.foreign('agent_address').references('address').inTable('agent_bot_configs');
  });

  // Bot Risk Management Table
  await knex.schema.createTable('bot_risk_events', function(table) {
    table.increments('id').primary();
    table.string('agent_address', 42).notNullable();
    table.integer('intent_id').nullable().comment('Related intent if applicable');
    table.string('risk_type', 50).notNullable().comment('Type of risk event');
    table.enum('risk_level', ['low', 'medium', 'high', 'critical']).notNullable();
    table.string('description', 500).notNullable();
    table.json('risk_data').nullable().comment('Risk assessment data');
    table.string('mitigation_action', 200).nullable().comment('Action taken to mitigate');
    table.boolean('resolved').defaultTo(false);
    table.bigInteger('created_at').notNullable();
    table.bigInteger('resolved_at').nullable();
    
    table.index(['agent_address']);
    table.index(['risk_type']);
    table.index(['risk_level']);
    table.index(['resolved']);
    table.foreign('agent_address').references('address').inTable('agent_bot_configs');
  });

  console.log('✅ Bot tables created successfully');
};

exports.down = async function(knex) {
  console.log('Dropping bot tables...');
  
  // Drop in reverse order due to foreign key constraints
  await knex.schema.dropTableIfExists('bot_risk_events');
  await knex.schema.dropTableIfExists('bot_strategy_performance');
  await knex.schema.dropTableIfExists('bot_monitoring_events');
  await knex.schema.dropTableIfExists('bot_performance_metrics');
  await knex.schema.dropTableIfExists('bot_execution_logs');
  await knex.schema.dropTableIfExists('agent_bot_configs');
  
  console.log('✅ Bot tables dropped successfully');
};