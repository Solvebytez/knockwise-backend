"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const startServer = async () => {
    try {
        // Connect to database
        await (0, database_1.connectDatabase)();
        console.log('✅ Connected to MongoDB');
        // Create Express app
        const app = (0, app_1.createApp)();
        // Create HTTP server
        const server = app.listen(env_1.env.port, () => {
            console.log(`🚀 Server running on port ${env_1.env.port}`);
            console.log(`📚 API Documentation: http://localhost:${env_1.env.port}/docs`);
            console.log(`🔍 Health Check: http://localhost:${env_1.env.port}/health`);
        });
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('Process terminated');
            });
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=server.js.map