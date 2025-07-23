const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { prisma } = require('./prisma');

require('dotenv').config();

// Configure Google OAuth Strategy
const configurePassport = () => {
    console.log('🔧 Configuring Passport Google OAuth Strategy...');
    
    // Determine callback URL based on environment
    const callbackURL = process.env.NODE_ENV === 'production' 
        ? process.env.GOOGLE_CALLBACK_URL 
        : `http://localhost:${process.env.PORT || 3000}/auth/google/callback`;
    
    console.log(`   Callback URL: ${callbackURL}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: callbackURL
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const googleId = profile.id;
            const name = profile.displayName;
            const profilePicture = profile.photos[0]?.value || null;

            console.log('🔍 Google OAuth Profile received:', {
                id: googleId,
                email: email,
                name: name
            });

            // Validate if email is ITK email
            if (!email.endsWith('@student.itk.ac.id')) {
                console.log('❌ Non-ITK email rejected:', email);
                return done(null, false, {
                    message: 'Only ITK student email (@student.itk.ac.id) is allowed.'
                });
            }

            // Extract student number from email
            const nim = email.split('@')[0];

            // Validate nim format (ITK student numbers typically start with specific patterns)
            if (!nim.match(/^[0-9]{8}$/)) {
                console.log('❌ Invalid NIM format:', nim);
                return done(null, false, {
                    message: 'Invalid student number format.'
                });
            }

            // Check if email is in admin list
            const adminEmails = process.env.ADMIN_EMAILS 
                ? process.env.ADMIN_EMAILS.split(',').map(adminEmail => adminEmail.trim()) 
                : [];
            const isAdmin = adminEmails.includes(email);

            console.log('🔍 Admin check:', { email, isAdmin, adminEmails: adminEmails.length });

            // Check if user already exists in the database
            let existingUser = await prisma.user.findUnique({
                where: { email: email }
            });

            if (existingUser) {
                // User exists, update Google ID and profile info
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

            // User does not exist, create a new user
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

    // Serialize user to store in session
    passport.serializeUser((user, done) => {
        console.log('🔄 Serializing user:', user.id);
        done(null, user.id);
    });

    // Deserialize user from session
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