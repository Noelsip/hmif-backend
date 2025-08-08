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

// ✅ FIX: Google OAuth dengan scope yang benar
router.get('/google', (req, res, next) => {
    const config = Environment.getConfig();
    
    console.log('🔍 Starting OAuth flow:', {
        environment: config.environment,
        callback: config.callback,
        userAgent: req.get('User-Agent')?.substring(0, 50),
        clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'
    });
    
    const authOptions = {
        scope: ['profile', 'email'],
        prompt: 'select_account',
        access_type: 'offline',
        include_granted_scopes: true
    };
    
    console.log('🔍 OAuth options:', authOptions);
    
    // ✅ FIX: Panggil passport.authenticate dengan options
    passport.authenticate('google', authOptions)(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/auth/failure',
        session: false
    }),
    async (req, res) => {
        try {
            const config = Environment.getConfig();
            const user = req.user;
            
            if (!user) {
                return res.redirect('/auth/failure?error=no_user_data');
            }

            console.log('✅ OAuth Success:', {
                user: user.email,
                environment: config.environment
            });

            // Generate tokens
            const accessToken = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    isAdmin: user.isAdmin || false
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
            );

            // Set cookies
            const cookieOptions = {
                httpOnly: true,
                secure: config.isProduction,
                sameSite: config.isProduction ? 'none' : 'lax',
                domain: config.isProduction ? process.env.COOKIE_DOMAIN : undefined
            };

            res.cookie('accessToken', accessToken, {
                ...cookieOptions,
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            res.cookie('refreshToken', refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Smart redirect berdasarkan environment
            if (config.isDevelopment || req.query.format === 'json') {
                return res.json({
                    success: true,
                    message: 'Authentication successful',
                    data: {
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            profilePicture: user.profilePicture,
                            nim: user.nim,
                            isAdmin: user.isAdmin || false
                        },
                        accessToken,
                        refreshToken,
                        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
                    },
                    environment: config.environment
                });
            } else {
                const redirectUrl = `${config.frontend}/auth/success?token=${encodeURIComponent(accessToken)}`;
                console.log('🔄 Redirecting to:', redirectUrl);
                return res.redirect(redirectUrl);
            }

        } catch (error) {
            console.error('❌ Callback Error:', error);
            res.redirect(`/auth/failure?error=${encodeURIComponent(error.message)}`);
        }
    }
);

// Debug OAuth URL endpoint
router.get('/debug/oauth-url', (req, res) => {
    const oauthUrl = `https://accounts.google.com/oauth2/auth?` +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL)}&` +
        `scope=${encodeURIComponent('profile email')}&` +
        `response_type=code&` +
        `prompt=select_account`;
    
    res.json({
        success: true,
        message: 'OAuth Debug URL',
        data: {
            generatedUrl: oauthUrl,
            clientId: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
            callbackUrl: process.env.GOOGLE_CALLBACK_URL,
            scopeUsed: 'profile email'
        }
    });
});

// Get current user
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
                createdAt: true
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
        console.error('Get user error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided'
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        
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
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 1000 // 1 hour
        });

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newAccessToken
            }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Auth failure route
router.get('/failure', (req, res) => {
    res.status(401).json({
        success: false,
        message: 'Authentication failed'
    });
});

module.exports = router;