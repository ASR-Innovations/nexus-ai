import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Interval } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { WebsocketService } from './websocket.service';

@WebSocketGateway({ 
  path: '/ws',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private websocketService: WebsocketService) {}

  handleConnection(client: WebSocket, request: any) {
    this.logger.log('WebSocket client connected');
    
    // Extract userId from query parameters or headers if provided
    const url = new URL(request.url, `http://${request.headers.host}`);
    const userId = url.searchParams.get('userId');
    
    if (userId) {
      this.websocketService.addConnection(userId, client);
      this.logger.log(`User ${userId} connected via WebSocket`);
    }

    // Set up pong handler for heartbeat
    client.on('pong', () => {
      (client as any).isAlive = true;
    });
  }

  handleDisconnect(client: WebSocket) {
    this.logger.log('WebSocket client disconnected');
    this.websocketService.handleDisconnect(client);
  }

  @Interval(30000) // Every 30 seconds
  handleHeartbeat() {
    if (!this.server) return;

    this.server.clients.forEach((client: WebSocket) => {
      if ((client as any).isAlive === false) {
        this.logger.log('Terminating inactive WebSocket connection');
        return client.terminate();
      }

      (client as any).isAlive = false;
      client.ping();
    });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: { intentId: number; userId: string },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      this.websocketService.subscribe(data.userId, data.intentId, client);
      this.logger.log(`Subscription successful for user ${data.userId} to intent ${data.intentId}`);
      return { success: true, message: `Subscribed to intent ${data.intentId}` };
    } catch (error) {
      this.logger.error(`Subscription failed: ${error}`);
      return { success: false, error: 'Subscription failed' };
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: { intentId: number },
    @ConnectedSocket() client: WebSocket,
  ) {
    try {
      this.websocketService.unsubscribe(data.intentId, client);
      this.logger.log(`Unsubscription successful for intent ${data.intentId}`);
      return { success: true, message: `Unsubscribed from intent ${data.intentId}` };
    } catch (error) {
      this.logger.error(`Unsubscription failed: ${error}`);
      return { success: false, error: 'Unsubscription failed' };
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: WebSocket) {
    // Respond to client ping with pong
    return { type: 'pong', timestamp: Date.now() };
  }
}