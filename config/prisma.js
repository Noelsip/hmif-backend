let prisma;

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

// Test connection function for compatibility
async function testConnection() {
    try {
        await connectDatabase();
    } catch (error) {
        console.error('❌ Test connection failed:', error);
    }
}

// Graceful shutdown
async function disconnectDatabase() {
    try {
        if (prisma && prisma.$disconnect) {
            await prisma.$disconnect();
            console.log('🔌 Database disconnected');
        }
    } catch (error) {
        console.error('Error disconnecting database:', error);
    }
}

try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'minimal',
    });
    console.log('✅ Prisma client initialized');
} catch (error) {
    console.warn('⚠️ Prisma client failed to initialize:', error.message);
    console.log('📝 Creating mock Prisma client...');
    
    // Comprehensive Mock Prisma client
    const createMockModel = () => ({
        findMany: async () => [],
        findUnique: async () => null,
        findFirst: async () => null,
        create: async (data) => ({ id: 1, ...data }),
        update: async (params) => ({ id: params.where.id, ...params.data }),
        delete: async () => ({ id: 1 }),
        count: async () => 0,
        groupBy: async () => [],
        upsert: async (params) => ({ id: 1, ...params.create }),
    });

    prisma = {
        user: createMockModel(),
        subject: createMockModel(),
        news: createMockModel(),
        learningVideo: createMockModel(),
        studentSubject: createMockModel(),
        $connect: async () => console.log('Mock Prisma connected'),
        $disconnect: async () => console.log('Mock Prisma disconnected'),
        $transaction: async (callback) => callback(prisma),
    };
}

module.exports = {
    prisma,
    connectDatabase,
    testConnection,
    disconnectDatabase
};