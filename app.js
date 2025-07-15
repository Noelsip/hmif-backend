require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('./config/passport');
const { connectDatabase, disconnectDatabase } = require('./config/prisma');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://10.0.2.2:3000',
        'http://127.0.0.1:3000',
        'http://10.160.132.88:3000',
        ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration for Passport
app.use(session({
    secret: process.env.SESSION_SECRET,
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

// Connect to database on startup
connectDatabase();

// Basic route untuk test
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'HMIF App Backend API is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString()
    });
});

// Import and use routes
try {
    const authRoutes = require('./routes/auth');
    const subjectRoutes = require('./routes/subject');
    const videoRoutes = require('./routes/videos');
    const newsRoutes = require('./routes/news');

    // Register routes
    app.use('/auth', authRoutes);
    app.use('/api/subject', subjectRoutes); // Fixed typo: subcject -> subject
    app.use('/api/videos', videoRoutes);
    app.use('/api/news', newsRoutes);
} catch (error) {
    console.error('❌ Error loading routes:', error.message);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
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
    console.log(`   GET  http://localhost:${PORT}/`);
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/auth/google`);
    console.log(`   POST http://localhost:${PORT}/auth/google`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await disconnectDatabase();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await disconnectDatabase();
    process.exit(0);
});

module.exports = app;