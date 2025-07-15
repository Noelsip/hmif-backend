const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');
const { validateStudentEmail, authenticate } = require('../middleware/auth');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// route for start Google OAuth authentication
router.get('/google',
    passport.authenticate('google', {
        scope: ['profile', 'email']
    })
);

// route for get id token from flutter
router.post('/google', async (req, res) => {
    try {
        console.log('📝 Received Google login request');
        console.log('🔍 Request body:', req.body);
        console.log('🔍 Request headers:', req.headers);

        const { idToken } = req.body;
        
        if (!idToken) {
            console.log('❌ No ID Token provided');
            console.log('📋 Available keys in body:', Object.keys(req.body));
            return res.status(400).json({
                success: false,
                message: 'ID Token is required'
            });
        }
        console.log('🔍 Verifying Google ID token...');
        console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set');

        // Verify the Google ID token
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;
        const googleId = payload.sub;

        console.log('✅ Google verification successful for:', email);

        // Validate ITK email
        if (!email.endsWith('@student.itk.ac.id')) {
            console.log('❌ Invalid email domain:', email);
            return res.status(400).json({
                success: false,
                message: 'Only ITK student email is allowed'
            });
        }

        // Extract NIM from email
        const nim = email.split('@')[0];
        if (!nim.startsWith('11')) {
            console.log('❌ Invalid NIM format:', nim);
            return res.status(400).json({
                success: false,
                message: 'Invalid student number format'
            });
        }

        // Check if user exists
        const getUserQuery = 'SELECT * FROM users WHERE email = ?';
        const userResult = await executeQuery(getUserQuery, [email]);

        let user;
        if (userResult.success && userResult.data.length > 0) {
            // User exists, update last login
            user = userResult.data[0];
            const updateLoginQuery = 'UPDATE users SET updated_at = NOW() WHERE id = ?';
            await executeQuery(updateLoginQuery, [user.id]);
        } else {
            // Create new user
            const insertUserQuery = `
                INSERT INTO users (nim, email, name, google_id, created_at, last_login) 
                VALUES (?, ?, ?, ?, NOW(), NOW())
            `;
            const insertResult = await executeQuery(insertUserQuery, [nim, email, name, googleId]);
            
            if (insertResult.success) {
                const newUserQuery = 'SELECT * FROM users WHERE id = ?';
                const newUserResult = await executeQuery(newUserQuery, [insertResult.data.insertId]);
                user = newUserResult.data[0];
            } else {
                throw new Error('Failed to create user');
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user.id,
                nim: user.nim,
                email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    nim: user.nim,
                    email: user.email,
                    name: user.name,
                    profileImageUrl: user.profile_image_url
                },
                token: token
            }
        });

    } catch (error) {
        console.error('💥 Google login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// router for Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/auth/failure',
        session: false
    }),
    async (req, res) => {
        try{
            // user successfully authenticated login
            const user = req.user;

            // generate JWT token
            const token = jwt.sign({
                userId: user.id,
                nim: user.nim,
                email: user.email,
            }, 
            process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN
            }
        );

        // update last login time
        const updateLoginQuery = 'UPDATE users SET last_login = NOW() WHERE id = ?';
        await executeQuery(updateLoginQuery, [user.id]);

        // respond with user data and token
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    nim: user.nim,
                    email: user.email,
                    name: user.name,
                    profileImageUrl: user.profile_image_url
                },
                token: token // Tambahkan token di response
            }
        });
        } catch (error) {
            console.error('Google OAuth callback error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message
            });
        }
    }
);

// router for Google OAuth failure
router.get('/failure', (req, res) => {
    res.status(401).json({
        success: false,
        message: 'Google authentication failed. Please ensure you use a valid ITK student email.'
    });
});

// router for logout
router.post('/logout', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Logout successful'
    });
});

// router for get user profile have a login - PERBAIKI INI
router.get('/profile', authenticate, async (req, res) => {
    try {
        // User sudah diset oleh middleware authenticate
        const user = req.user;

        res.status(200).json({
            success: true,
            data: {
                id: user.id,
                nim: user.nim,
                email: user.email,
                name: user.name,
                profile_image_url: user.profile_image_url,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Error getting user profile:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get user profile.',
            error: error.message
        });
    }
});

// route for refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required.'
            });
        }

        // verify refresh token must be expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // check if user exists in database
        const getUserQuery = 'SELECT id, nim, email FROM users WHERE id = ?';
        const userResult = await executeQuery(getUserQuery, [decoded.userId]);

        if (!userResult.success || userResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        const user = userResult.data[0];

        // generate new access token
        const newToken = jwt.sign({
            userId: decoded.userId,
            nim: decoded.nim,
            email: decoded.email,
        }, 
        process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });

        res.status(200).json({
            success: true,
            data: {
                accessToken: newToken
            }
        });
    } catch (error) {
        console.error('Error refreshing token:', error.message);
        res.status(401).json({
            success: false,
            message: 'Invalid refresh token.',
            error: error.message
        });
    }
});

// Route for search user by nim
router.get('/search', async (req, res) => {
    try {
        const { nim } = req.query;

        // validate format NIM
        if (!nim.startsWith('11') || !/^\d{10,12}$/.test(nim)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid NIM format'
            });
        }

        // search user by nim
        const searchUserQuery = `
        SELECT id, nim, email, name, profile_image_url
        FROM users
        WHERE nim = ?
        `;
        const studentResult = await executeQuery(searchUserQuery, [nim]);

        if (!studentResult.success || studentResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found Or Database error.'
            });
        }

        res.status(200).json({
            success: true,
            data: studentResult.data[0]
        });
    } catch (error) {
        console.error('Error searching user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to search user.',
            error: error.message
        });
    }
});

// Test POST endpoint
router.post('/test', (req, res) => {
    console.log('📝 Test POST request received');
    console.log('🔍 Request body:', req.body);
    console.log('🔍 Request headers:', req.headers);
    
    res.json({
        success: true,
        message: 'POST test successful',
        receivedData: req.body,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;