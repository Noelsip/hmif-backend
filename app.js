require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const NetworkUtils = require('./utils/network');
const authRoutes = require('./routes/auth');



const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Get current network info
const networkInfo = {
    interface: 'eth0',
    ip: process.env.VPS_IP || '31.97.51.165',
    subnet: '31.97.51'
};

console.log('🌐 VPS Network Info:');
console.log(`   IP: ${networkInfo.ip}`);
console.log(`   Subnet: ${networkInfo.subnet}`);
console.log('');

// Generate CORS origins
const corsOrigins = [
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    `http://${networkInfo.ip}:${PORT}`,
    `https://${networkInfo.ip}:${HTTPS_PORT}`,
    // Frontend origins
    `http://${networkInfo.ip}:3000`,
    `http://${networkInfo.ip}:3001`,
    `http://${networkInfo.ip}:4200`,
    `http://${networkInfo.ip}:5173`,
    `http://${networkInfo.ip}:8080`,
    `https://${networkInfo.ip}:3000`,
    `https://${networkInfo.ip}:3001`,
    `https://${networkInfo.ip}:4200`,
    `https://${networkInfo.ip}:5173`,
    `https://${networkInfo.ip}:8080`
];

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
    
    // Debug logging
    console.log('✅ Swagger loaded successfully');
    console.log('   - swaggerUi:', !!swaggerUi);
    console.log('   - swaggerSpec:', !!swaggerSpec);
    console.log('   - swaggerUiOptions:', !!swaggerUiOptions);
    
    if (!swaggerSpec) {
        throw new Error('Swagger spec is null');
    }
    
} catch (error) {
    console.error('❌ Failed to load Swagger:', error.message);
    console.error('   - Stack:', error.stack);
    swaggerUi = null;
    swaggerSpec = null;
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
            imgSrc: ["'self'", "data:", "https:", "http:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"]
        },
    },
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false,
    hsts: false // Disable HSTS untuk self-signed cert
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
    maxAge: 86400
}));

console.log('✅ CORS configured for VPS IP:', networkInfo.ip);

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
    try {
        app.use('/docs-swagger', swaggerUi.serve);
        app.get('/docs-swagger', swaggerUi.setup(swaggerSpec, swaggerUiOptions));
        console.log('✅ Swagger documentation available at /docs-swagger');
    } catch (error) {
        console.error('❌ Failed to setup Swagger UI:', error.message);
    }
} else {
    console.warn('⚠️ Swagger not configured:');
    console.warn('   - swaggerUi:', !!swaggerUi);
    console.warn('   - swaggerSpec:', !!swaggerSpec);
    console.warn('   - Check dependencies and configuration');
    
    // Create fallback endpoint
    app.get('/docs-swagger', (req, res) => {
        res.json({
            success: false,
            message: 'Swagger documentation not available',
            error: 'Swagger configuration failed to load',
            troubleshooting: [
                'Check if swagger-jsdoc and swagger-ui-express are installed',
                'Verify ./config/swagger.js file exists',
                'Check ./utils/network.js implementation',
                'Run: npm install swagger-jsdoc swagger-ui-express'
            ]
        });
    });
}

// Network info endpoint
app.get('/network-info', (req, res) => {
    const protocol = req.secure ? 'https' : 'http';
    const currentPort = req.secure ? HTTPS_PORT : PORT;
    
    res.json({
        success: true,
        message: 'VPS Network information',
        data: {
            ...networkInfo,
            corsOrigins,
            accessUrls: {
                http: `http://${networkInfo.ip}:${PORT}`,
                https: `https://${networkInfo.ip}:${HTTPS_PORT}`,
                documentation: `${protocol}://${networkInfo.ip}:${currentPort}/docs-swagger`,
                health: `${protocol}://${networkInfo.ip}:${currentPort}/health`,
                auth: `${protocol}://${networkInfo.ip}:${currentPort}/auth/google`
            },
            ssl: {
                enabled: process.env.SSL_ENABLED === 'true',
                selfSigned: true,
                validFor: networkInfo.ip
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

let server;
let useHTTPS = false;

if (process.env.SSL_ENABLED === 'true') {
    try {
        const keyPath = process.env.SSL_PRIVATE_KEY_PATH || './ssl/private-key.pem';
        const certPath = process.env.SSL_CERTIFICATE_PATH || './ssl/certificate.pem';
        
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            const sslOptions = {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };

            // Create HTTPS server
            server = https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
                console.log('\n🚀 HMIF Backend HTTPS Server Started Successfully!');
                console.log('═════════════════════════════════════════');
                console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`🔒 HTTPS URL: https://${networkInfo.ip}:${HTTPS_PORT}`);
                console.log(`❤️  Health Check: https://${networkInfo.ip}:${HTTPS_PORT}/health`);
                if (swaggerUi) console.log(`📚 Documentation: https://${networkInfo.ip}:${HTTPS_PORT}/docs-swagger`);
                if (passport) console.log(`🔐 Google OAuth: https://${networkInfo.ip}:${HTTPS_PORT}/auth/google`);
                console.log(`⚠️  Browser will show security warning (self-signed certificate)`);
                console.log(`💡 To accept: Click "Advanced" -> "Proceed to ${networkInfo.ip}"`);
                console.log('═════════════════════════════════════════\n');
            });

            useHTTPS = true;

            // HTTP redirect to HTTPS
            http.createServer((req, res) => {
                const httpsUrl = `https://${networkInfo.ip}:${HTTPS_PORT}${req.url}`;
                res.writeHead(301, { 
                    "Location": httpsUrl,
                    "Content-Type": "text/plain"
                });
                res.end(`Redirecting to HTTPS: ${httpsUrl}`);
            }).listen(PORT, '0.0.0.0', () => {
                console.log(`🔄 HTTP redirect: http://${networkInfo.ip}:${PORT} -> https://${networkInfo.ip}:${HTTPS_PORT}`);
            });

        } else {
            console.warn('⚠️  SSL certificate files not found');
            console.warn(`   Looking for: ${keyPath}, ${certPath}`);
            console.warn('⚠️  Run SSL generation script first');
            throw new Error('SSL files not found');
        }

    } catch (error) {
        console.error('❌ HTTPS setup failed:', error.message);
        console.log('⚠️  Starting HTTP server instead...');
        useHTTPS = false;
    }
}

if (!useHTTPS) {
    // HTTP Server
    server = app.listen(PORT, '0.0.0.0', () => {
        console.log('\n🚀 HMIF Backend HTTP Server Started Successfully!');
        console.log('═════════════════════════════════════════');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🏠 Local URL: http://localhost:${PORT}`);
        console.log(`📡 VPS URL: http://${networkInfo.ip}:${PORT}`);
        console.log(`❤️  Health Check: http://${networkInfo.ip}:${PORT}/health`);
        if (swaggerUi) console.log(`📚 Documentation: http://${networkInfo.ip}:${PORT}/docs-swagger`);
        if (passport) console.log(`🔐 Google OAuth: http://${networkInfo.ip}:${PORT}/auth/google`);
        console.log(`🌐 CORS Origins: ${corsOrigins.length} origins configured`);
        console.log('═════════════════════════════════════════\n');
    });
}

// Handle server errors
server.on('error', (error) => {
    console.error('❌ Server Error:', error);
    logger.error('Server error:', error);
});

module.exports = app;