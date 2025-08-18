const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
const Environment = require('../config/environment');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

const router = express.Router();

router.get('/google', (req, res, next) => {
    try {
        const config = Environment.getConfig();
        
        console.log('🔍 Starting OAuth flow:', {
            environment: config.environment,
            callback: config.callback,
            isDevelopment: config.isDevelopment,
            userAgent: req.get('User-Agent')?.substring(0, 50),
            timestamp: new Date().toISOString()
        });
        
        // ✅ Validate required environment variables
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('❌ Google OAuth credentials missing!');
            return res.status(500).json({
                success: false,
                message: 'OAuth configuration error',
                error: 'Google OAuth credentials not configured'
            });
        }
        
        const authOptions = {
            scope: ['profile', 'email'],
            accessType: 'offline',
            prompt: 'select_account'
        };
        
        passport.authenticate('google', authOptions)(req, res, next);
        
    } catch (error) {
        console.error('❌ OAuth initiation error:', error);
        return res.status(500).json({
            success: false,
            message: 'OAuth initiation failed',
            error: error.message
        });
    }
});

// ✅ Enhanced Google OAuth callback with detailed error handling
router.get('/google/callback',
    (req, res, next) => {
        console.log('🔍 OAuth callback received:', {
            query: req.query,
            hasCode: !!req.query.code,
            hasError: !!req.query.error,
            timestamp: new Date().toISOString()
        });
        
        // Check for OAuth errors from Google
        if (req.query.error) {
            console.error('❌ OAuth error from Google:', req.query.error);
            return res.redirect(`/auth/failure?error=${encodeURIComponent(req.query.error)}`);
        }
        
        if (!req.query.code) {
            console.error('❌ No authorization code received');
            return res.redirect('/auth/failure?error=no_code');
        }
        
        next();
    },
    passport.authenticate('google', {
        failureRedirect: '/auth/failure',
        session: false
    }),
    async (req, res) => {
        try {
            console.log('🔍 OAuth callback processing...');
            
            const config = Environment.getConfig();
            const user = req.user;
            
            if (!user) {
                console.error('❌ No user data from OAuth');
                return res.redirect('/auth/failure?error=no_user_data');
            }

            console.log('✅ OAuth Success for user:', {
                id: user.id,
                email: user.email,
                name: user.name,
                isAdmin: user.isAdmin
            });

            // ✅ Validate JWT secrets
            if (!process.env.JWT_SECRET) {
                console.error('❌ JWT_SECRET not configured');
                throw new Error('JWT configuration missing');
            }

            // Generate tokens
            const accessToken = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    isAdmin: user.isAdmin || false
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
                { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
            );

            console.log('✅ Tokens generated successfully');

            // Set cookies
            const cookieOptions = {
                httpOnly: true,
                secure: config.isProduction && config.sslEnabled,
                sameSite: config.isProduction ? 'none' : 'lax',
                path: '/'
            };

            res.cookie('accessToken', accessToken, {
                ...cookieOptions,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie('refreshToken', refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            console.log('✅ Cookies set successfully');

            // Response based on environment
            if (config.isDevelopment) {
                console.log('🔄 Development: Returning JSON response');
                return res.json({
                    success: true,
                    message: 'Authentication successful',
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            profilePicture: user.profilePicture,
                            isAdmin: user.isAdmin || false
                        },
                        accessToken,
                        refreshToken
                    }
                });
            } else {
                // Production: Redirect to frontend
                const redirectUrl = `${config.frontend}/auth/success?token=${encodeURIComponent(accessToken)}`;
                console.log('🔄 Production: Redirecting to:', redirectUrl);
                return res.redirect(redirectUrl);
            }

        } catch (error) {
            console.error('❌ OAuth Callback Error:', {
                message: error.message,
                stack: error.stack,
                user: req.user ? { id: req.user.id, email: req.user.email } : null,
                timestamp: new Date().toISOString()
            });
            
            // Return JSON error instead of redirect for better debugging
            return res.status(500).json({
                success: false,
                message: 'OAuth processing failed',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication error',
                requestId: req.requestId
            });
        }
    }
);

router.get('/success', (req, res) => {
    try {
        const config = Environment.getConfig();
        const token = req.query.token;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'No token provided'
            });
        }

        // verify the token to get user information
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // get user data from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
                profilePicture: true,
                isAdmin: true
            }
        });

        console.log('🔍 OAuth Success Response:', {
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            requestId: req.requestId,
            token: token.substring(0, 20) + '...',
            timestamp: new Date().toISOString()
        });

        // return JSON response
        res.json({
            success: true,
            message: 'Authentication successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    profilePicture: user.profilePicture,
                    isAdmin: user.isAdmin || false
                },
                token: token
            }
        });
    } catch (error) {
        console.error('❌ OAuth Success Error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
})

// Enhanced debug endpoint
router.get('/debug/oauth-config', (req, res) => {
    try {
        const config = Environment.getConfig();
        
        const debugInfo = {
            success: true,
            message: 'OAuth Debug Information',
            data: {
                environment: config.environment,
                callback: config.callback,
                baseUrl: config.baseUrl,
                frontend: config.frontend,
                sslEnabled: config.sslEnabled,
                credentials: {
                    clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
                    jwtSecret: process.env.JWT_SECRET ? 'SET' : 'NOT SET'
                },
                generatedUrl: `https://accounts.google.com/oauth2/auth?` +
                    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
                    `redirect_uri=${encodeURIComponent(config.callback)}&` +
                    `scope=${encodeURIComponent('profile email')}&` +
                    `response_type=code&` +
                    `prompt=select_account`,
                database: prisma ? 'CONNECTED' : 'NOT CONNECTED'
            }
        };
        
        res.json(debugInfo);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Debug endpoint error',
            error: error.message
        });
    }
});

// Enhanced get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
                profilePicture: true,
                isAdmin: true,
                createdAt: true,
                lastLoginAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('❌ Get user error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Token validation failed'
        });
    }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided'
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
        
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const newAccessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                isAdmin: user.isAdmin 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 1000,
            path: '/'
        });

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken
            }
        });

    } catch (error) {
        console.error('❌ Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Token refresh failed'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Enhanced failure route
router.get('/failure', (req, res) => {
    const error = req.query.error || 'unknown_error';
    
    console.log('❌ OAuth failure:', {
        error,
        query: req.query,
        timestamp: new Date().toISOString()
    });
    
    res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: error,
        details: req.query
    });
});

module.exports = router;