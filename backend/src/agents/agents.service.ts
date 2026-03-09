import { Injectable, Logger } from '@nestjs/common';
import { DatabaseProvider } from '../shared/database.provider';
import { RedisProvider } from '../shared/redis.provider';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private databaseProvider: DatabaseProvider,
    private redisProvider: RedisProvider,
  ) {}

  async getAgents(sort: string = 'reputation', limit: number = 20, offset: number = 0) {
    try {
      let orderBy = 'reputation_score DESC';
      
      switch (sort) {
        case 'volume':
          orderBy = 'total_executions DESC';
          break;
        case 'success_rate':
          orderBy = '(success_count::float / NULLIF(total_executions, 0)) DESC';
          break;
        default:
          orderBy = 'reputation_score DESC';
      }

      const result = await this.databaseProvider.query(
        `SELECT * FROM agents WHERE is_active = true 
         ORDER BY ${orderBy} 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const countResult = await this.databaseProvider.query(
        'SELECT COUNT(*) FROM agents WHERE is_active = true'
      );

      // Fetch and cache metadata for each agent
      const agentsWithMetadata = await Promise.all(
        result.rows.map(async (agent: any) => {
          const metadata = await this.fetchAndCacheMetadata(agent.address, agent.metadata_uri);
          return {
            ...agent,
            metadata_json: metadata,
          };
        })
      );

      return {
        agents: agentsWithMetadata,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      this.logger.error('Get agents error:', error);
      throw error;
    }
  }

  async getAgent(address: string) {
    try {
      const agentResult = await this.databaseProvider.query(
        'SELECT * FROM agents WHERE address = $1',
        [address]
      );

      if (agentResult.rows.length === 0) {
        return null;
      }

      const agent = agentResult.rows[0];

      // Fetch and cache metadata
      const metadata = await this.fetchAndCacheMetadata(agent.address, agent.metadata_uri);

      // Get recent executions for this agent
      const executionsResult = await this.databaseProvider.query(
        `SELECT i.*, e.status as execution_status, e.completed_at 
         FROM intents i 
         LEFT JOIN executions e ON i.id = e.intent_id 
         WHERE i.assigned_agent = $1 
         ORDER BY i.created_at DESC 
         LIMIT 10`,
        [address]
      );

      return {
        agent: {
          ...agent,
          metadata_json: metadata,
        },
        recentExecutions: executionsResult.rows,
      };
    } catch (error) {
      this.logger.error('Get agent error:', error);
      throw error;
    }
  }

  /**
   * Fetch agent metadata from IPFS and cache in PostgreSQL
   * Requirements: 12.4, 12.5
   */
  private async fetchAndCacheMetadata(agentAddress: string, metadataUri?: string): Promise<any> {
    try {
      // Check if metadata is already cached in database
      const cachedResult = await this.databaseProvider.query(
        'SELECT metadata_json FROM agents WHERE address = $1 AND metadata_json IS NOT NULL',
        [agentAddress]
      );

      if (cachedResult.rows.length > 0 && cachedResult.rows[0].metadata_json) {
        return cachedResult.rows[0].metadata_json;
      }

      // If no metadata URI, return default metadata
      if (!metadataUri) {
        const defaultMetadata = {
          name: `Agent ${agentAddress.slice(0, 8)}`,
          description: 'No description provided',
          image: null,
          website: null,
          contact: null,
        };
        
        // Cache default metadata
        await this.cacheMetadataInDatabase(agentAddress, defaultMetadata);
        return defaultMetadata;
      }

      // Fetch from IPFS
      const metadata = await this.fetchFromIPFS(metadataUri);
      
      // Cache in database
      await this.cacheMetadataInDatabase(agentAddress, metadata);
      
      return metadata;
    } catch (error) {
      this.logger.error(`Failed to fetch metadata for agent ${agentAddress}:`, error);
      
      // Return fallback metadata
      return {
        name: `Agent ${agentAddress.slice(0, 8)}`,
        description: 'Metadata unavailable',
        image: null,
        website: null,
        contact: null,
        error: 'Failed to fetch metadata',
      };
    }
  }

  /**
   * Fetch metadata from IPFS
   */
  private async fetchFromIPFS(uri: string): Promise<any> {
    try {
      // Handle different IPFS URI formats
      let url: string;
      
      if (uri.startsWith('ipfs://')) {
        // Convert ipfs:// to HTTP gateway
        const hash = uri.replace('ipfs://', '');
        url = `https://ipfs.io/ipfs/${hash}`;
      } else if (uri.startsWith('https://') || uri.startsWith('http://')) {
        url = uri;
      } else {
        // Assume it's just the hash
        url = `https://ipfs.io/ipfs/${uri}`;
      }

      this.logger.debug(`Fetching metadata from: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const metadata = await response.json();
      
      // Validate metadata structure
      if (typeof metadata !== 'object') {
        throw new Error('Invalid metadata format');
      }

      return {
        name: metadata.name || 'Unknown Agent',
        description: metadata.description || 'No description provided',
        image: metadata.image || null,
        website: metadata.website || null,
        contact: metadata.contact || null,
        ...metadata, // Include any additional fields
      };
    } catch (error) {
      this.logger.error(`IPFS fetch failed for URI ${uri}:`, error);
      throw error;
    }
  }

  /**
   * Cache metadata in PostgreSQL
   */
  private async cacheMetadataInDatabase(agentAddress: string, metadata: any): Promise<void> {
    try {
      await this.databaseProvider.query(
        'UPDATE agents SET metadata_json = $1, updated_at = $2 WHERE address = $3',
        [JSON.stringify(metadata), Date.now(), agentAddress]
      );
      
      this.logger.debug(`Cached metadata for agent ${agentAddress}`);
    } catch (error) {
      this.logger.error(`Failed to cache metadata for agent ${agentAddress}:`, error);
      // Don't throw - caching failure shouldn't break the request
    }
  }
}