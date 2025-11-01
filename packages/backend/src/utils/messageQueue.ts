/**
 * Simple in-memory message queue for email delivery
 * In production, this would be replaced with Redis or a proper message queue
 */

interface QueueMessage {
  id: string;
  data: any;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
  nextRetry?: Date;
}

export class MessageQueue {
  private queues: Map<string, QueueMessage[]> = new Map();
  private processing: Set<string> = new Set();

  /**
   * Add message to queue
   */
  async enqueue(queueName: string, data: any, maxAttempts: number = 3): Promise<string> {
    const messageId = crypto.randomUUID();
    const message: QueueMessage = {
      id: messageId,
      data,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    this.queues.get(queueName)!.push(message);
    return messageId;
  }

  /**
   * Get messages from queue
   */
  async dequeue(queueName: string, limit: number = 10): Promise<QueueMessage[]> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return [];
    }

    const now = new Date();
    const availableMessages = queue.filter(msg => 
      !this.processing.has(msg.id) && 
      (!msg.nextRetry || msg.nextRetry <= now)
    );

    const messages = availableMessages.slice(0, limit);
    
    // Mark messages as processing
    messages.forEach(msg => this.processing.add(msg.id));

    return messages;
  }

  /**
   * Acknowledge message completion
   */
  async acknowledge(messageId: string): Promise<void> {
    this.processing.delete(messageId);
    
    // Remove message from all queues
    for (const [queueName, queue] of this.queues.entries()) {
      const index = queue.findIndex(msg => msg.id === messageId);
      if (index !== -1) {
        queue.splice(index, 1);
        break;
      }
    }
  }

  /**
   * Retry message with exponential backoff
   */
  async retry(messageId: string, error: string): Promise<void> {
    this.processing.delete(messageId);

    for (const [queueName, queue] of this.queues.entries()) {
      const message = queue.find(msg => msg.id === messageId);
      if (message) {
        message.attempts++;
        
        if (message.attempts >= message.maxAttempts) {
          // Remove failed message
          const index = queue.indexOf(message);
          queue.splice(index, 1);
          console.error(`Message ${messageId} failed after ${message.attempts} attempts: ${error}`);
        } else {
          // Schedule retry with exponential backoff
          const backoffMs = Math.pow(2, message.attempts) * 1000; // 2s, 4s, 8s, etc.
          message.nextRetry = new Date(Date.now() + backoffMs);
        }
        break;
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(queueName: string): { total: number; processing: number; failed: number } {
    const queue = this.queues.get(queueName) || [];
    const processing = queue.filter(msg => this.processing.has(msg.id)).length;
    const failed = queue.filter(msg => msg.attempts >= msg.maxAttempts).length;
    
    return {
      total: queue.length,
      processing,
      failed
    };
  }
}