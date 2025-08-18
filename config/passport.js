const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./prisma');
const Environment = require('./environment');

require('dotenv').config();

const configurePassport = () => {
    console.log('🔧 Configuring Passport Google OAuth Strategy...');
    
    const config = Environment.getConfig();
    const callbackURL = config.callback;
    
    console.log(`   Environment: ${config.environment}`);
    console.log(`   Callback URL: ${callbackURL}`);
    console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
    console.log(`   Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);

    // ✅ Validate OAuth credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('❌ Google OAuth credentials missing!');
        throw new Error('Google OAuth credentials are required');
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL,
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🔍 OAuth Profile received:', {
                id: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName
            });

            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;
            const name = profile.displayName;
            const profilePicture = profile.photos?.[0]?.value;

            if (!email) {
                return done(new Error('No email found in Google profile'), null);
            }

            // Check if user exists
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: email },
                        { googleId: googleId }
                    ]
                }
            });

            if (user) {
                // Update existing user
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        googleId: googleId,
                        name: name,
                        profilePicture: profilePicture,
                        lastLoginAt: new Date()
                    }
                });
            } else {
                // Create new user
                user = await prisma.user.create({
                    data: {
                        email: email,
                        googleId: googleId,
                        name: name,
                        profilePicture: profilePicture,
                        isAdmin: process.env.ADMIN_EMAILS?.split(',').includes(email) || false,
                        lastLoginAt: new Date()
                    }
                });
            }

            console.log('✅ User processed:', {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            });

            return done(null, user);

        } catch (error) {
            console.error('❌ OAuth Strategy Error:', error);
            return done(error, null);
        }
    }));

    // Serialize user
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: id }
            });
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    console.log('✅ Passport Google OAuth Strategy configured');
};

module.exports = { configurePassport, passport };