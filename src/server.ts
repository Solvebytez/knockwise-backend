import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { CronService } from './services/cronService';
import { EmailService } from './services/emailService';
import { SocketService } from './services/socketService';

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to MongoDB');

    // Create Express app
    const app = createApp();

    // Create HTTP server
    const server = app.listen(env.port, () => {
      console.log(`🚀 Server running on port ${env.port}`);
      console.log(`📚 API Documentation: http://localhost:${env.port}/docs`);
      console.log(`🔍 Health Check: http://localhost:${env.port}/health`);
    });

    // Initialize email service
    EmailService.initialize();
    
    // Initialize Socket.IO
    SocketService.initialize(server);
    
    // Initialize cron jobs for scheduled assignments
    CronService.initializeCronJobs();
    console.log('⏰ Cron jobs initialized');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();


