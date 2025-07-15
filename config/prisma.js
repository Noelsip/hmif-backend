const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Test database connection
async function connectDatabase() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully with Prisma');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

// Graceful shutdown
async function disconnectDatabase() {
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
}

module.exports = {
    prisma,
    connectDatabase,
    disconnectDatabase
};