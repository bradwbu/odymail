import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env, isDevelopment } from './config/environment.js';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import emailRoutes from './routes/email.js';
import storageRoutes from './routes/storage.js';
import billingRoutes from './routes/billing.js';
import securityRoutes from './routes/security.js';
import privacyRoutes from './routes/privacy.js';
import abusePreventionRoutes from './routes/abuse-prevention.js';
import { EmailService } from './services/emailService.js';
import { NotificationService } from './services/notificationService.js';
import { FileStorageService } from './services/fileStorageService.js';
import { BillingService } from './services/billingService.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV 
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  try {
    const { default: metricsService } = await import('./services/metricsService.js');
    const metrics = await metricsService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ 
    message: 'Encrypted Email Service API',
    version: '1.0.0'
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// User routes
app.use('/api/user', userRoutes);

// Email routes
app.use('/api/email', emailRoutes);

// Storage routes
app.use('/api/storage', storageRoutes);

// Billing routes
app.use('/api/billing', billingRoutes);

// Security routes
app.use('/api/security', securityRoutes);

// Privacy routes
app.use('/api/privacy', privacyRoutes);

// Abuse prevention routes
app.use('/api/abuse-prevention', abusePreventionRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (isDevelopment()) {
    res.status(500).json({
      error: {
        message: err.message,
        stack: err.stack
      }
    });
  } else {
    res.status(500).json({
      error: {
        message: 'Internal server error'
      }
    });
  }
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found'
    }
  });
});

// Initialize database connection
await connectDatabase();

// Initialize file storage
await FileStorageService.initializeStorage();

// Initialize storage plans
await BillingService.initializeStoragePlans();

// Start email delivery queue processor
const startEmailProcessor = () => {
  setInterval(async () => {
    try {
      await EmailService.processDeliveryQueue();
    } catch (error) {
      console.error('Email queue processing error:', error);
    }
  }, 5000); // Process every 5 seconds
};

// Create HTTP server
const httpServer = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server: httpServer,
  path: '/ws'
});

// WebSocket authentication and connection handling
wss.on('connection', (ws, req) => {
  try {
    // Extract token from query string or headers
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    // Register client with notification service
    NotificationService.addClient(userId, ws);
    
    ws.on('close', () => {
      NotificationService.removeClient(userId, ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      NotificationService.removeClient(userId, ws);
    });

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('WebSocket authentication error:', error);
    ws.close(1008, 'Invalid token');
  }
});

const server = httpServer.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT}`);
  console.log(`📧 Encrypted Email Service API ready`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`🔌 WebSocket server ready at ws://localhost:${env.PORT}/ws`);
  
  // Start background email processor
  startEmailProcessor();
  console.log(`📬 Email delivery processor started`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;