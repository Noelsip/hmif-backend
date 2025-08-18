const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./prisma');
const Environment = require('./environment');

require('dotenv').config();

const configurePassport = () => {
    console.log('🔧 Configuring Passport Google OAuth Strategy...');
    
    try {
        const config = Environment.getConfig();
        const callbackURL = config.callback;
        
        console.log(`   Environment: ${config.environment}`);
        console.log(`   DuckDNS Domain: ${config.duckDnsDomain || 'localhost'}`);
        console.log(`   Callback URL: ${callbackURL}`);
        console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT SET'}`);
        console.log(`   Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);

        // ✅ Validate OAuth credentials
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('❌ Google OAuth credentials missing!');
            console.error('   GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET');
            console.error('   GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET');
            throw new Error('Google OAuth credentials are required');
        }

        // ✅ Validate DuckDNS for production
        if (config.isProduction) {
            Environment.validateDuckDnsConfig();
        }

        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: callbackURL,
            scope: ['profile', 'email']
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                console.log('🔍 OAuth Strategy Processing...', {
                    profileId: profile.id,
                    email: profile.emails?.[0]?.value,
                    name: profile.displayName,
                    callbackUsed: callbackURL,
                    timestamp: new Date().toISOString()
                });

                const email = profile.emails?.[0]?.value;
                const googleId = profile.id;
                const name = profile.displayName;
                const profilePicture = profile.photos?.[0]?.value;

                if (!email) {
                    console.error('❌ No email found in Google profile');
                    return done(new Error('No email found in Google profile'), null);
                }

                console.log('🔍 Database query starting...');

                // Check if user exists
                let user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: email },
                            { googleId: googleId }
                        ]
                    }
                });

                console.log('🔍 User lookup result:', user ? 'FOUND' : 'NOT FOUND');

                if (user) {
                    console.log('🔄 Updating existing user...');
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
                    console.log('✅ User updated successfully');
                } else {
                    console.log('🔄 Creating new user...');
                    // Create new user
                    const isAdmin = process.env.ADMIN_EMAILS?.split(',').includes(email) || false;
                    
                    user = await prisma.user.create({
                        data: {
                            email: email,
                            googleId: googleId,
                            name: name,
                            profilePicture: profilePicture,
                            isAdmin: isAdmin,
                            lastLoginAt: new Date()
                        }
                    });
                    console.log('✅ User created successfully');
                }

                console.log('✅ User processed successfully:', {
                    id: user.id,
                    email: user.email,
                    isAdmin: user.isAdmin,
                    lastLoginAt: user.lastLoginAt
                });

                return done(null, user);

            } catch (error) {
                console.error('❌ OAuth Strategy Database Error:', {
                    message: error.message,
                    stack: error.stack,
                    email: profile.emails?.[0]?.value,
                    profileId: profile.id,
                    timestamp: new Date().toISOString()
                });
                return done(error, null);
            }
        }));

        // Serialize user for session
        passport.serializeUser((user, done) => {
            console.log('🔍 Serializing user:', user.id);
            done(null, user.id);
        });

        // Deserialize user from session
        passport.deserializeUser(async (id, done) => {
            try {
                console.log('🔍 Deserializing user:', id);
                const user = await prisma.user.findUnique({
                    where: { id: id }
                });
                console.log('✅ User deserialized:', user ? 'SUCCESS' : 'NOT FOUND');
                done(null, user);
            } catch (error) {
                console.error('❌ Deserialize error:', error);
                done(error, null);
            }
        });

        console.log('✅ Passport Google OAuth Strategy configured successfully');
        
    } catch (error) {
        console.error('❌ Passport configuration failed:', error);
        throw error;
    }
};

module.exports = { configurePassport, passport };