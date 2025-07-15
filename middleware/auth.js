const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Middleware untuk validasi email student ITK
const validateStudentEmail = (email) => {
    if (!email || !email.endsWith('@student.itk.ac.id')) {
        return false;
    }
    
    const nim = email.split('@')[0];
  // Validasi format NIM (contoh: dimulai dengan 11 untuk tahun 2011, dst)
    return /^\d{8,12}$/.test(nim);
};

// Middleware untuk authenticate JWT token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const getUserQuery = 'SELECT * FROM users WHERE id = ?';
        const userResult = await executeQuery(getUserQuery, [decoded.userId]);

        if (!userResult.success || userResult.data.length === 0) {
        return res.status(401).json({
            success: false,
            message: 'User not found'
        });
        }

        // Attach user to request object
        req.user = userResult.data[0];
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
        message: 'Authentication failed',
        error: error.message
        });
    }
};

// Middleware untuk check admin role
const requireAdmin = async (req, res, next) => {
    try {
        const user = req.user;
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(email => email.trim()) : [];
        
        if (!adminEmails.includes(user.email)) {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        error: error.message
        });
    }
};

console.log('✅ Auth middleware loaded successfully');

module.exports = {
    validateStudentEmail,
    authenticate,
    requireAdmin
};