let client, connectRedis;

try {
    const redis = require('redis');
    
    client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    connectRedis = async () => {
        try {
            await client.connect();
            console.log('✅ Connected to Redis');
        } catch (error) {
            console.error('❌ Error connecting to Redis:', error);
        }
    };

} catch (error) {
    console.warn('⚠️ Redis module not found, creating mock client');
    
    // Mock Redis client
    client = {
        connect: async () => console.log('Mock Redis connected'),
        disconnect: async () => console.log('Mock Redis disconnected'),
        get: async () => null,
        set: async () => true,
        del: async () => true,
        on: () => {},
    };
    
    connectRedis = async () => {
        console.log('📝 Mock Redis connection established');
    };
}

module.exports = {
    client,
    connectRedis
};