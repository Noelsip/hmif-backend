const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
const Environment = require('./config/environment');


/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Start Google OAuth authentication
 *     description: Redirect to Google OAuth for authentication
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handle Google OAuth callback and generate JWT tokens
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Login successful (development mode)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       302:
 *         description: Redirect to frontend (production mode)
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user information
 *     description: Retrieve information about the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No token provided or invalid token
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Generate a new access token using refresh token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: No refresh token provided or invalid refresh token
 */

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Clear authentication cookies and logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */

/**
 * @swagger
 * /auth/failure:
 *   get:
 *     summary: Authentication failure
 *     description: Handle authentication failure
 *     tags: [Authentication]
 *     responses:
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */

const router = express.Router();

// Google OAuth dengan environment detection
router.get('/google', (req, res, next) => {
    const config = Environment.getConfig();
    
    console.log('🔍 Starting OAuth flow:', {
        environment: config.environment,
        callback: config.callback,
        userAgent: req.get('User-Agent')?.substring(0, 50)
    });
    
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })(req, res, next);
});

// Enhanced callback dengan smart redirect
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

            // Smart redirect berdasarkan environment dan client
            const userAgent = req.get('User-Agent') || '';
            const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
            
            if (config.isDevelopment || req.query.format === 'json') {
                // Development atau explicit JSON request
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
                // Production atau web redirect
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

// Mobile/API Auth endpoint
router.post('/mobile', async (req, res) => {
    try {
        const { idToken, platform } = req.body;
        
        if (!idToken) {
            return res.status(400).json({
                success: false,
                message: 'ID token is required'
            });
        }

        // Verify Google ID Token (implement with google-auth-library)
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        
        // Find or create user
        let user = await prisma.user.findUnique({
            where: { googleId: payload.sub }
        });

        if (!user) {
            const email = payload.email;
            const nim = email.includes('@student.itk.ac.id') 
                ? email.split('@')[0] 
                : null;

            user = await prisma.user.create({
                data: {
                    googleId: payload.sub,
                    email: email,
                    name: payload.name,
                    profilePicture: payload.picture,
                    nim: nim,
                    isAdmin: false,
                    isActive: true
                }
            });
        } else {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    lastLoginAt: new Date(),
                    profilePicture: payload.picture
                }
            });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                isAdmin: user.isAdmin || false
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Mobile authentication successful',
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
                expiresIn: '24h'
            }
        });

    } catch (error) {
        console.error('❌ Mobile Auth Error:', error);
        res.status(401).json({
            success: false,
            message: 'Mobile authentication failed',
            error: error.message
        });
    }
});

// Environment info endpoint
router.get('/environment', (req, res) => {
    const config = Environment.getConfig();
    
    res.json({
        success: true,
        data: {
            environment: config.environment,
            api: config.api,
            frontend: config.frontend,
            callback: config.callback,
            networkInfo: config.networkInfo,
            corsOrigins: config.corsOrigins
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

        // Generate new access token
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