import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ExecutionUpdate } from './websocket.dto';

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);
  private connections = new Map<string, WebSocket[]>(); // userId -> WebSocket[]
  private subscriptions = new Map<number, WebSocket[]>(); // intentId -> WebSocket[]
  private clientToUser = new Map<WebSocket, string>(); // client -> userId

  addConnection(userId: string, client: WebSocket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }
    this.connections.get(userId)!.push(client);
    this.clientToUser.set(client, userId);
    
    // Mark client as alive for heartbeat
    (client as any).isAlive = true;
  }

  subscribe(userId: string, intentId: number, client: WebSocket) {
    // Ensure client is tracked
    if (!this.clientToUser.has(client)) {
      this.addConnection(userId, client);
    }

    // Add to intent subscriptions
    if (!this.subscriptions.has(intentId)) {
      this.subscriptions.set(intentId, []);
    }
    
    const clients = this.subscriptions.get(intentId)!;
    if (!clients.includes(client)) {
      clients.push(client);
    }

    this.logger.log(`User ${userId} subscribed to intent ${intentId}`);
  }

  unsubscribe(intentId: number, client: WebSocket) {
    const clients = this.subscriptions.get(intentId);
    if (clients) {
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
        this.logger.log(`Client unsubscribed from intent ${intentId}`);
      }
      if (clients.length === 0) {
        this.subscriptions.delete(intentId);
      }
    }
  }

  handleDisconnect(client: WebSocket) {
    const userId = this.clientToUser.get(client);
    
    // Remove from user connections
    if (userId) {
      const clients = this.connections.get(userId);
      if (clients) {
        const index = clients.indexOf(client);
        if (index > -1) {
          clients.splice(index, 1);
          this.logger.log(`Removed client for user ${userId}`);
        }
        if (clients.length === 0) {
          this.connections.delete(userId);
        }
      }
    }

    // Remove from all intent subscriptions
    for (const [intentId, clients] of this.subscriptions.entries()) {
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.subscriptions.delete(intentId);
        }
      }
    }

    // Remove client tracking
    this.clientToUser.delete(client);
  }

  broadcast(intentId: number, update: ExecutionUpdate) {
    const clients = this.subscriptions.get(intentId);
    if (clients && clients.length > 0) {
      const message = JSON.stringify(update);
      let sentCount = 0;
      
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
            sentCount++;
          } catch (error) {
            this.logger.error(`Failed to send message to client: ${error}`);
          }
        }
      });
      
      this.logger.log(`Broadcasted update for intent ${intentId} to ${sentCount} clients`);
    }
  }

  sendToUser(userId: string, message: any) {
    const clients = this.connections.get(userId);
    if (clients && clients.length > 0) {
      const messageStr = JSON.stringify(message);
      let sentCount = 0;
      
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(messageStr);
            sentCount++;
          } catch (error) {
            this.logger.error(`Failed to send message to user ${userId}: ${error}`);
          }
        }
      });
      
      this.logger.log(`Sent message to user ${userId} via ${sentCount} connections`);
    }
  }

  // Event broadcasting methods for IndexerService
  broadcastIntentUpdate(intentId: number, status: string, currentStep?: number, totalSteps?: number) {
    const update: ExecutionUpdate = {
      type: 'intent_update',
      intentId,
      status,
      currentStep,
      totalSteps,
      timestamp: Date.now(),
    };
    this.broadcast(intentId, update);
  }

  broadcastXCMSent(intentId: number, paraId: number, txHash: string) {
    const update: ExecutionUpdate = {
      type: 'xcm_sent',
      intentId,
      paraId,
      txHash,
      timestamp: Date.now(),
    };
    this.broadcast(intentId, update);
  }

  broadcastExecutionComplete(intentId: number, returnAmount: string) {
    const update: ExecutionUpdate = {
      type: 'execution_complete',
      intentId,
      returnAmount,
      timestamp: Date.now(),
    };
    this.broadcast(intentId, update);
  }

  broadcastExecutionFailed(intentId: number, error: string) {
    const update: ExecutionUpdate = {
      type: 'execution_failed',
      intentId,
      error,
      timestamp: Date.now(),
    };
    this.broadcast(intentId, update);
  }

  getConnectionCount(): number {
    let total = 0;
    for (const clients of this.connections.values()) {
      total += clients.length;
    }
    return total;
  }

  getSubscriptionCount(): number {
    let total = 0;
    for (const clients of this.subscriptions.values()) {
      total += clients.length;
    }
    return total;
  }
}