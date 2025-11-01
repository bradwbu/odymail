/**
 * Real-time notification service using WebSocket
 */

import { WebSocket } from 'ws';

interface NotificationClient {
  userId: string;
  ws: WebSocket;
  connectedAt: Date;
}

export interface EmailNotification {
  type: 'new_email' | 'email_delivered' | 'email_failed';
  emailId: string;
  senderId?: string;
  senderEmail?: string;
  subject?: string;
  timestamp: Date;
}

export class NotificationService {
  private static clients: Map<string, Set<WebSocket>> = new Map();

  /**
   * Add a WebSocket client for a user
   */
  static addClient(userId: string, ws: WebSocket): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    
    this.clients.get(userId)!.add(ws);
    console.log(`WebSocket client connected for user ${userId}`);
  }

  /**
   * Remove a WebSocket client for a user
   */
  static removeClient(userId: string, ws: WebSocket): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(ws);
      
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
    console.log(`WebSocket client disconnected for user ${userId}`);
  }

  /**
   * Send notification to a specific user
   */
  static async notifyUser(userId: string, notification: EmailNotification): Promise<void> {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.size === 0) {
      return; // User not connected
    }

    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    // Send to all connected clients for this user
    const deadClients: WebSocket[] = [];
    
    for (const ws of userClients) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        } else {
          deadClients.push(ws);
        }
      } catch (error) {
        console.error('Failed to send notification:', error);
        deadClients.push(ws);
      }
    }

    // Clean up dead connections
    deadClients.forEach(ws => this.removeClient(userId, ws));
  }

  /**
   * Send notification to multiple users
   */
  static async notifyUsers(userIds: string[], notification: EmailNotification): Promise<void> {
    await Promise.all(
      userIds.map(userId => this.notifyUser(userId, notification))
    );
  }

  /**
   * Broadcast notification to all connected users
   */
  static async broadcast(notification: EmailNotification): Promise<void> {
    const message = JSON.stringify({
      type: 'notification',
      data: notification
    });

    for (const [userId, userClients] of this.clients.entries()) {
      const deadClients: WebSocket[] = [];
      
      for (const ws of userClients) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
          } else {
            deadClients.push(ws);
          }
        } catch (error) {
          console.error('Failed to broadcast notification:', error);
          deadClients.push(ws);
        }
      }

      // Clean up dead connections
      deadClients.forEach(ws => this.removeClient(userId, ws));
    }
  }

  /**
   * Get connected users count
   */
  static getConnectedUsersCount(): number {
    return this.clients.size;
  }

  /**
   * Get total connections count
   */
  static getTotalConnectionsCount(): number {
    let total = 0;
    for (const userClients of this.clients.values()) {
      total += userClients.size;
    }
    return total;
  }

  /**
   * Check if user is connected
   */
  static isUserConnected(userId: string): boolean {
    const userClients = this.clients.get(userId);
    return userClients ? userClients.size > 0 : false;
  }
}