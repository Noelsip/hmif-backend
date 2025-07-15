const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./prisma');
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
        const profilePicture = profile.photos[0]?.value || null;

        // Validate if email is ITK email
        if (!email.endsWith('@student.itk.ac.id')) {
            return done(null, false, {
                message: 'Only ITK student email is allowed.'
            });
        }

        // Extract student number from email
        const nim = email.split('@')[0];

        // Validate nim format
        if (!nim.startsWith('11')) {
            return done(null, false, {
                message: 'Invalid student number format.'
            });
        }

        // Check if email is in admin list
        const adminEmails = process.env.ADMIN_EMAILS 
            ? process.env.ADMIN_EMAILS.split(',').map(adminEmail => adminEmail.trim()) 
            : [];
        const isAdmin = adminEmails.includes(email);

        // Check if user already exists in the database
        let existingUser = await prisma.user.findUnique({
            where: { email: email }
        });

        if (existingUser) {
            // User exists, update Google ID and admin status if needed
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    googleId: googleId,
                    name: name,
                    profilePicture: profilePicture,
                    isAdmin: isAdmin
                }
            });
            return done(null, updatedUser);
        }

        // User does not exist, create a new user
        const newUser = await prisma.user.create({
            data: {
                email: email,
                name: name,
                googleId: googleId,
                profilePicture: profilePicture,
                isAdmin: isAdmin
            }
        });

        console.log(`✅ New user created: ${email} ${isAdmin ? '(Admin)' : '(User)'}`);
        return done(null, newUser);

    } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
    }
}));

// Serialize user to store in session
passport.serializeUser((user, done) => {
    done(null, { id: user.id, type: 'user' });
});

// Deserialize user from session
passport.deserializeUser(async (sessionData, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: sessionData.id },
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
            return done(null, user);
        }
        return done(null, false);

    } catch (error) {
        console.error('Error deserializing user:', error);
        return done(error, null);
    }
});

module.exports = passport;