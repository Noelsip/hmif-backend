const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./prisma');

require('dotenv').config();

// Configure Google OAuth Strategy
const configurePassport = () => {
    console.log('🔧 Configuring Passport Google OAuth Strategy...');
    
    // ✅ FIX: Gunakan GOOGLE_CALLBACK_URL langsung atau fallback
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
        `https://${process.env.VPS_IP || 'localhost'}:${process.env.HTTPS_PORT || 3443}/auth/google/callback`;
    
    console.log(`   Callback URL: ${callbackURL}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
    console.log(`   Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);

    // ✅ FIX: Validate OAuth credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error('❌ Google OAuth credentials missing!');
        throw new Error('Google OAuth credentials not configured');
    }

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('🔍 Raw Google Profile:', {
                id: profile.id,
                emails: profile.emails,
                displayName: profile.displayName,
                photos: profile.photos
            });

            if (!profile.emails || profile.emails.length === 0) {
                console.error('❌ No email found in Google profile');
                return done(null, false, {
                    message: 'No email associated with this Google account'
                });
            }

            const email = profile.emails[0].value;
            const googleId = profile.id;
            const name = profile.displayName;
            const profilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            console.log('🔍 Google OAuth Profile processed:', {
                id: googleId,
                email: email,
                name: name,
                profilePicture: profilePicture ? 'YES' : 'NO'
            });

            // flexible email validation
            if (!email.endsWith('@student.itk.ac.id')) {
                console.log('❌ Email not allowed:', email);
                return done(null, false, {
                    message: 'Only ITK student email (@student.itk.ac.id) or Gmail for testing is allowed.'
                });
            }

            // Extract NIM (only for ITK emails)
            let nim = null;
            if (email.endsWith('@student.itk.ac.id')) {
                nim = email.split('@')[0];
                
                // Validate nim format
                if (!nim.match(/^[0-9]{8}$/)) {
                    console.log('❌ Invalid NIM format:', nim);
                    return done(null, false, {
                        message: 'Invalid student number format.'
                    });
                }
            }

            // Check if email is in admin list
            const adminEmails = process.env.ADMIN_EMAILS 
                ? process.env.ADMIN_EMAILS.split(',').map(adminEmail => adminEmail.trim()) 
                : [];
            const isAdmin = adminEmails.includes(email);

            console.log('🔍 Admin check:', { email, isAdmin, adminCount: adminEmails.length });

            // Check if user already exists
            let existingUser = await prisma.user.findUnique({
                where: { email: email }
            });

            if (existingUser) {
                // Update existing user
                const updatedUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        googleId: googleId,
                        name: name,
                        profilePicture: profilePicture,
                        isAdmin: isAdmin,
                        nim: nim,
                        isActive: true,
                        lastLoginAt: new Date()
                    }
                });

                console.log(`✅ User updated: ${email} ${isAdmin ? '(Admin)' : '(User)'}`);
                return done(null, updatedUser);
            }

            // Create new user
            const newUser = await prisma.user.create({
                data: {
                    email: email,
                    name: name,
                    googleId: googleId,
                    profilePicture: profilePicture,
                    nim: nim,
                    isAdmin: isAdmin,
                    isActive: true,
                    lastLoginAt: new Date()
                }
            });

            console.log(`✅ New user created: ${email} ${isAdmin ? '(Admin)' : '(User)'}`);
            return done(null, newUser);

        } catch (error) {
            console.error('❌ Google OAuth Strategy Error:', error);
            return done(error, null);
        }
    }));

    // Serialize user
    passport.serializeUser((user, done) => {
        console.log('🔄 Serializing user:', user.id);
        done(null, user.id);
    });

    // Deserialize user
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: parseInt(id) },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    profilePicture: true,
                    nim: true,
                    isAdmin: true,
                    isActive: true,
                    createdAt: true,
                    lastLoginAt: true
                }
            });

            if (user) {
                console.log('🔄 User deserialized:', user.email);
                return done(null, user);
            }
            
            console.log('❌ User not found during deserialization:', id);
            return done(null, false);

        } catch (error) {
            console.error('❌ Error deserializing user:', error);
            return done(error, null);
        }
    });

    console.log('✅ Passport Google OAuth Strategy configured');
};

module.exports = { configurePassport, passport };