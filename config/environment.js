const NetworkUtils = require('../utils/network');

class Environment {
    static getConfig() {
        const networkInfo = NetworkUtils.getNetworkInfo();
        const isProduction = process.env.NODE_ENV === 'production';
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        // Base URLs berdasarkan environment
        const baseUrls = {
            development: {
                api: `http://localhost:${process.env.PORT || 3000}`,
                frontend: process.env.FRONTEND_URL || 'http://localhost:8080',
                callback: `http://localhost:${process.env.PORT || 3000}/auth/google/callback`
            },
            production: {
                api: process.env.API_URL || `https://${process.env.DOMAIN}`,
                frontend: process.env.FRONTEND_URL || `https://${process.env.DOMAIN}`,
                callback: process.env.GOOGLE_CALLBACK_URL || `https://${process.env.DOMAIN}/auth/google/callback`
            },
            testing: {
                api: `http://localhost:${process.env.PORT || 3000}`,
                frontend: `http://${networkInfo.ip}:8080`,
                callback: `http://localhost:${process.env.PORT || 3000}/auth/google/callback`
            }
        };

        const currentEnv = isProduction ? 'production' : 
                          process.env.ENABLE_NETWORK_ACCESS === 'true' ? 'testing' : 'development';
        
        return {
            ...baseUrls[currentEnv],
            environment: currentEnv,
            networkInfo,
            corsOrigins: this.generateCorsOrigins(baseUrls[currentEnv]),
            isProduction,
            isDevelopment
        };
    }

    static generateCorsOrigins(urls) {
        const origins = [
            'http://localhost:3000',
            'http://localhost:3001', 
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            urls.frontend,
            urls.api
        ];

        // Add network IPs for testing
        if (process.env.ENABLE_NETWORK_ACCESS === 'true') {
            const networkInfo = NetworkUtils.getNetworkInfo();
            origins.push(
                `http://${networkInfo.ip}:3000`,
                `http://${networkInfo.ip}:3001`,
                `http://${networkInfo.ip}:8080`
            );
        }

        return [...new Set(origins.filter(Boolean))];
    }
}

module.exports = Environment;