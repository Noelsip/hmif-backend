require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const NetworkUtils = require('./utils/network');

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

// Generate CORS origins
const corsOrigins = NetworkUtils.generateCorsOrigins(PORT);

// Safe imports with error handling
let prisma, disconnectDatabase, testConnection, redisClient, connectRedis, logger, requestIdMiddleware, rateLimiters;
let swaggerUi, swaggerSpec, swaggerUiOptions;
let passport, configurePassport;

console.log('📦 Loading modules...');

// Load Prisma
try {
    const prismaConfig = require('./config/prisma');
    prisma = prismaConfig.prisma;
    disconnectDatabase = prismaConfig.disconnectDatabase;
    testConnection = prismaConfig.testConnection;
    console.log('✅ Prisma loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Prisma:', error.message);
    prisma = null;
}

// Load Redis
try {
    const redisConfig = require('./config/redis');
    redisClient = redisConfig.redisClient;
    connectRedis = redisConfig.connectRedis;
    console.log('✅ Redis loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Redis:', error.message);
    redisClient = null;
}

// Load Logger
try {
    logger = require('./config/logger');
    console.log('✅ Logger loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Logger:', error.message);
    logger = { info: console.log, error: console.error, warn: console.warn };
}

// Load Request ID Middleware
try {
    requestIdMiddleware = require('./middleware/requestId');
    console.log('✅ Request ID middleware loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Request ID middleware:', error.message);
    requestIdMiddleware = (req, res, next) => next();
}

// Load Rate Limiters
try {
    rateLimiters = require('./middleware/rateLimiter');
    console.log('✅ Rate limiters loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Rate limiters:', error.message);
    rateLimiters = {};
}

// Load Swagger
try {
    const swaggerConfig = require('./config/swagger');
    swaggerUi = swaggerConfig.swaggerUi;
    swaggerSpec = swaggerConfig.swaggerSpec;
    swaggerUiOptions = swaggerConfig.swaggerUiOptions;
    console.log('✅ Swagger loaded successfully');
} catch (error) {
    console.error('❌ Failed to load Swagger:', error.message);
    swaggerUi = null;
}

// Load Passport
try {
    const passportConfig = require('./config/passport');
    passport = passportConfig.passport;
    configurePassport = passportConfig.configurePassport;
    
    // Configure passport strategies
    configurePassport();
    
    console.log('✅ Passport loaded and configured successfully');
} catch (error) {
    console.error('❌ Failed to load Passport:', error.message);
    passport = null;
}

console.log('⚙️ Configuring middleware...');

// Basic middleware
app.use(requestIdMiddleware);
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false
}));

console.log('✅ Security middleware configured');

// Enhanced CORS configuration
app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID',
        'X-API-Key'
    ],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24 hours
}));

console.log('✅ CORS configured with origins:', corsOrigins);

// Standard middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'hmif-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

console.log('✅ Session middleware configured');

// Initialize Passport
if (passport) {
    app.use(passport.initialize());
    app.use(passport.session());
    console.log('✅ Passport middleware initialized');
} else {
    console.warn('⚠️ Passport not available, authentication will not work');
}

// Test connections
(async () => {
    console.log('🔍 Testing connections...');
    
    // Test database connection
    if (testConnection) {
        try {
            await testConnection();
            console.log('✅ Database connection successful');
        } catch (error) {
            console.error('❌ Database connection failed:', error.message);
        }
    }
    
    // Test Redis connection
    if (connectRedis) {
        try {
            await connectRedis();
            console.log('✅ Redis connection successful');
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
        }
    }
})();

// Basic routes
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'HMIF Backend API is running',
        data: {
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            network: networkInfo,
            features: {
                database: !!prisma,
                redis: !!redisClient,
                authentication: !!passport,
                documentation: !!swaggerUi
            }
        }
    });
});

app.get('/health', async (req, res) => {
    const healthStatus = {
        success: true,
        message: 'Server is healthy',
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            services: {
                database: 'unknown',
                redis: 'unknown',
                passport: !!passport
            },
            memory: process.memoryUsage(),
            network: networkInfo
        }
    };

    // Test database
    if (testConnection) {
        try {
            await testConnection();
            healthStatus.data.services.database = 'connected';
        } catch (error) {
            healthStatus.data.services.database = 'disconnected';
            healthStatus.success = false;
        }
    }

    // Test Redis
    if (redisClient) {
        try {
            await redisClient.ping();
            healthStatus.data.services.redis = 'connected';
        } catch (error) {
            healthStatus.data.services.redis = 'disconnected';
        }
    }

    const statusCode = healthStatus.success ? 200 : 503;
    res.status(statusCode).json(healthStatus);
});

// Import and use routes
try {
    const authRoutes = require('./routes/auth');
    app.use('/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Failed to load auth routes:', error.message);
}

// Swagger documentation
if (swaggerUi && swaggerSpec) {
    app.use('/docs-swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'HMIF Backend API Documentation',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            tryItOutEnabled: true
        }
    }));
    console.log('✅ Swagger documentation available at /docs-swagger');
}

// Network info endpoint
app.get('/network-info', (req, res) => {
    const dockerEnv = NetworkUtils.generateDockerEnv(PORT);
    
    res.json({
        success: true,
        message: 'Network information',
        data: {
            ...networkInfo,
            ...dockerEnv,
            corsOrigins,
            accessUrls: {
                local: `http://localhost:${PORT}`,
                network: `http://${networkInfo.ip}:${PORT}`,
                documentation: `http://${networkInfo.ip}:${PORT}/docs-swagger`,
                health: `http://${networkInfo.ip}:${PORT}/health`
            }
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Global Error:', error);
    logger.error('Global error:', error);
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        requestId: req.requestId
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /network-info',
            'GET /auth/google',
            'POST /auth/logout',
            'GET /docs-swagger'
        ],
        requestId: req.requestId
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    
    if (disconnectDatabase) {
        await disconnectDatabase();
    }
    
    if (redisClient) {
        await redisClient.quit();
    }
    
    process.exit(0);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 HMIF Backend Server Started Successfully!');
    console.log('═════════════════════════════════════════');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏠 Local URL: http://localhost:${PORT}`);
    console.log(`📡 Network URL: http://${networkInfo.ip}:${PORT}`);
    console.log(`❤️  Health Check: http://${networkInfo.ip}:${PORT}/health`);
    if (swaggerUi) console.log(`📚 Documentation: http://${networkInfo.ip}:${PORT}/docs-swagger`);
    if (passport) console.log(`🔐 Google OAuth: http://${networkInfo.ip}:${PORT}/auth/google`);
    console.log(`🌐 CORS Origins: ${corsOrigins.join(', ')}`);
    console.log('═════════════════════════════════════════\n');
});

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server Error:', error);
    logger.error('Server error:', error);
});

module.exports = app;