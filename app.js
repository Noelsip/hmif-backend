require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Get current network info
const networkInfo = NetworkUtils.getNetworkInfo();
console.log('🌐 Network Info:', networkInfo);

console.log('🌐 Auto-detected Network Info:');
console.log(`   Interface: ${networkInfo.interface}`);
console.log(`   IP: ${networkInfo.ip}`);
console.log(`   Subnet: ${networkInfo.subnet}`);
console.log('');

// Generate CORS origins - Fixed the function call
const corsOrigins = NetworkUtils.generateCorsOrigins(PORT);

// Safe imports with error handling
let passport, prisma, disconnectDatabase, redisClient, connectRedis, logger, requestIdMiddleware, rateLimiters;
let swaggerUi, swaggerSpec, swaggerUiOptions;

console.log('📦 Loading modules...');

// Load Prisma
try {
    console.log('🗄️ Loading Prisma...');
    const prismaModule = require('./config/prisma');
    prisma = prismaModule.prisma;
    disconnectDatabase = prismaModule.disconnectDatabase;
    console.log('✅ Prisma client initialized');
} catch (error) {
    console.warn('⚠️ Prisma config failed to load:', error.message);
}

// Load Redis
try {
    console.log('🔴 Loading Redis...');
    const redisModule = require('./config/redis');
    redisClient = redisModule.client;
    connectRedis = redisModule.connectRedis;
    console.log('✅ Redis loaded successfully');
} catch (error) {
    console.warn('⚠️ Redis module not found, creating mock client');
    redisClient = {
        isReady: false,
        get: () => Promise.resolve(null),
        set: () => Promise.resolve('OK'),
        del: () => Promise.resolve(1),
        ping: () => Promise.resolve('PONG')
    };
    connectRedis = async () => console.log('📝 Mock Redis connection established');
}

// Load Logger
try {
    console.log('📝 Loading Logger...');
    logger = require('./config/logger');
    console.log('✅ Logger loaded successfully');
} catch (error) {
    console.warn('⚠️ Logger config failed, using console');
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn
    };
}

// Load Request ID Middleware
try {
    console.log('🆔 Loading Request ID middleware...');
    requestIdMiddleware = require('./middleware/requestId');
    console.log('✅ Request ID middleware loaded');
} catch (error) {
    console.warn('⚠️ RequestId middleware failed, using dummy');
    requestIdMiddleware = (req, res, next) => {
        req.requestId = Date.now().toString();
        next();
    };
}

// Load Rate Limiters
try {
    console.log('🚦 Loading Rate limiters...');
    rateLimiters = require('./middleware/rateLimiter');
    console.log('✅ Rate limiters loaded');
} catch (error) {
    console.warn('⚠️ Rate limiter failed, using dummy');
    rateLimiters = {
        general: (req, res, next) => next(),
        auth: (req, res, next) => next(),
        upload: (req, res, next) => next()
    };
}

// Load Swagger
try {
    console.log('📋 Loading Swagger...');
    const swaggerConfig = require('./config/swagger');
    swaggerUi = swaggerConfig.swaggerUi;
    swaggerSpec = swaggerConfig.swaggerSpec;
    swaggerUiOptions = swaggerConfig.swaggerUiOptions;
    console.log('✅ Swagger loaded successfully');
} catch (error) {
    console.warn('⚠️ Swagger not available:', error.message);
}

// Load Passport
try {
    console.log('🔑 Loading Passport...');
    passport = require('./config/passport');
    console.log('✅ Passport loaded successfully');
} catch (error) {
    console.warn('⚠️ Passport not available:', error.message);
}

console.log('⚙️ Configuring middleware...');

// Basic middleware
app.use(requestIdMiddleware);
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false
}));

console.log('✅ Security middleware configured');

// Enhanced CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // In Docker or production, use environment variable
        if (process.env.CORS_ORIGINS) {
            const allowedOrigins = process.env.CORS_ORIGINS.split(',');
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                return callback(null, true);
            }
        }
        
        // Auto-generated origins for development
        if (!origin || corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // Allow for development
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

console.log('✅ CORS configured');

// Other middleware
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));
app.use(rateLimiters.general);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration for Passport
app.use(session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Test database connection on startup
testConnection();

// Basic route untuk test
app.get('/', (req, res) => {
    res.json({
        message: 'HMIF App Backend API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            docs: '/docs',
            api: '/api'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        status: {
            prisma: prisma ? 'available' : 'mock',
            redis: redisClient && redisClient.isReady ? 'connected' : 'mock',
            passport: passport ? 'available' : 'unavailable'
        }
    });
});

// Network info endpoint
app.get('/network-info', (req, res) => {
    res.json({
        success: true,
        network: networkInfo,
        server: {
            host: process.env.SERVER_HOST || '0.0.0.0',
            port: PORT,
            external_url: process.env.EXTERNAL_URL || `http://${networkInfo.ip}:${PORT}`
        },
        access: {
            local: `http://localhost:${PORT}`,
            network: `http://${networkInfo.ip}:${PORT}`,
            docs: `http://${networkInfo.ip}:${PORT}/docs`
        },
        cors_origins: corsOrigins.slice(0, 10), // Show first 10 for brevity
        environment: process.env.NODE_ENV || 'development'
    });
});

// Import and use auth routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/auth', authRoutes);
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading auth routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Global error:', {
        message: err.message,
        stack: err.stack,
        requestId: req.requestId
    });
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        requestId: req.requestId
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        requestId: req.requestId
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'Not configured'}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`📱 Android Emulator URL: http://10.0.2.2:${PORT}`);
    console.log(`🔗 Available endpoints:`);
    console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/`);
    console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/health`);
    console.log(`   GET  ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/auth/google`);
    console.log(`   POST ${PORT === 3000 ? 'http://localhost:3000' : `http://localhost:${PORT}`}/auth/google`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;