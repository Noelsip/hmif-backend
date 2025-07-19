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


try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
        log: ['error'],
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

const disconnectDatabase = async () => {
    try {
        if (prisma && prisma.$disconnect) {
            await prisma.$disconnect();
            console.log('Database disconnected');
        }
    } catch (error) {
        console.error('Error disconnecting database:', error);
    }
};

module.exports = { prisma, disconnectDatabase };
