const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');

// Authenticate JWT token
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from cookies or Authorization header
        const token = req.cookies.accessToken || 
                     (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
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
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach user to request object
        req.user = user;
        next();

    } catch (error) {
        console.error('Authentication error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

// Require admin privileges
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    if (!req.user.isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Admin privileges required'
        });
    }

    next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken || 
                     (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

        if (token) {
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

            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    optionalAuth
};