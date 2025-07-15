const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { executeQuery } = require('./database');
require('dotenv').config();

// Google OAuth strategy configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        // validate is email is itk email
        if (!email.endsWith('@student.itk.ac.id')) {
            return done(null, false, {
                message: 'Only itk student email is allowed.'
            });
        }

        // extract student number from email
        const nim = email.split('@')[0];

        // validate nim from email
        if (!nim.startsWith('11')) {
            return done(null, false, {
                message: 'Invalid student number format.'
            });
        }

        // Check if user already exists in the database
        const checkUserQuery = 'SELECT id, nim, email, name FROM users WHERE email = ?';
        const existingUser = await executeQuery(checkUserQuery, [email, googleId]);

        if (existingUser.success && existingUser.data.length > 0) {
            // User exists, return the user
            const user = existingUser.data[0];

            if (!user.googleId) {
                // Update user with Google ID if not already set
                const updateUserQuery = 'UPDATE users SET googleId = ?, updated_at = NOW() WHERE id = ?';
                await executeQuery(updateUserQuery, [googleId, user.id]);
                user.googleId = googleId;
            }
            return done(null, user);
        }

        // User does not exist, create a new user
        const insertUserQuery = 'INSERT INTO users (nim, email, name, googleId) VALUES (?, ?, ?, ?)';
        const newUserResult = await executeQuery(insertUserQuery, [nim, email, name, googleId]);

        if (newUserResult.success) {
            // get data user after insert
            const getUserQuery = 'SELECT * FROM users WHERE id = ?';
            const userResult = await executeQuery(getUserQuery, [newUserResult.data.insertId]);

            if (userResult.success && userResult.data.length > 0) {
                return done(null, userResult.data[0]);
            }
        }

        return done(new Error('Failed to create new user.'), null);
    } catch (error) {
        console.error('Google OAuth error:', error.message);
        return done(error, null);
    }
}));

// Serialize user to store in session
passport.serializeUser((user, done) => {
    done(null, {id: user.id, type: 'user'});
});

// Deserialize user from session
passport.deserializeUser(async (sessionData, done) => {
    try {
        let query, params;

        // Check if sessionData is for user or admin
        if (sessionData.type === 'admin') {
            query = 'SELECT id, nim, email, name FROM admins WHERE id = ?';
        }
        else {
            query = 'SELECT id, nim, email, name, profile_image_url FROM users WHERE id = ?';
        }

        params = [sessionData.id];
        const result = await executeQuery(query, params);

        if (result.success && result.data.length > 0) {
            const userData = result.data[0];
            userData.type = sessionData.type;
            
            return done(null, userData);
        }
        return done(null, false);
    } catch (error) {
        console.error('Error deserializing user:', error.message);
        return done(error, null);
    }
});
module.exports = passport;