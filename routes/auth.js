const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');

const router = express.Router();

// Google OAuth login
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/auth/failure',
        session: false
    }),
    async (req, res) => {
        try {
            const user = req.user;
            
            // Generate JWT tokens
            const accessToken = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    isAdmin: user.isAdmin 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN }
            );

            // Set HTTP-only cookies
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            if (process.env.NODE_ENV === 'development') {
                return res.json({
                    success: true,
                    message: 'Login successful',
                    data: {
                        accessToken,
                        refreshToken,
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            isAdmin: user.isAdmin
                        }
                    }
                });
            }

            // Redirect to frontend
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
            res.redirect(`${frontendUrl}/auth/success`);

        } catch (error) {
            console.error('Auth callback error:', error);
            res.redirect('/auth/failure');
        }
    }
);

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