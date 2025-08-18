const NetworkUtils = require('../utils/network');

class Environment {
    static getConfig() {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const isProduction = process.env.NODE_ENV === 'production';
        const networkInfo = NetworkUtils.getNetworkInfo();
        
        // ✅ DuckDNS Domain Configuration
        const duckDnsDomain = process.env.DUCKDNS_DOMAIN; // e.g., "hmif-backend.duckdns.org"
        const httpsPort = process.env.HTTPS_PORT || 3443;
        const httpPort = process.env.PORT || 3000;
        
        // ✅ Smart URL building dengan DuckDNS
        const baseUrl = isDevelopment 
            ? `http://localhost:${httpPort}`
            : duckDnsDomain 
                ? `https://${duckDnsDomain}:${httpsPort}`
                : `https://${process.env.VPS_IP || networkInfo.ip}:${httpsPort}`;
        
        const frontendUrl = isDevelopment
            ? `http://localhost:${httpPort}`
            : process.env.FRONTEND_URL || baseUrl;

        // ✅ DuckDNS-compatible callback URL
        const callbackUrl = isDevelopment 
            ? `http://localhost:${httpPort}/auth/google/callback`
            : duckDnsDomain
                ? `https://${duckDnsDomain}:${httpsPort}/auth/google/callback`
                : `https://${process.env.VPS_IP || networkInfo.ip}:${httpsPort}/auth/google/callback`;

        return {
            environment: process.env.NODE_ENV || 'development',
            isDevelopment,
            isProduction,
            port: httpPort,
            httpsPort: httpsPort,
            
            // DuckDNS info
            duckDnsDomain,
            
            // URLs
            callback: callbackUrl,
            frontend: frontendUrl,
            baseUrl: baseUrl,
            
            // SSL settings
            sslEnabled: process.env.SSL_ENABLED === 'true' && isProduction,
            
            // Network info
            networkInfo
        };
    }
    
    static validateDuckDnsConfig() {
        const config = this.getConfig();
        
        if (config.isProduction && !config.duckDnsDomain) {
            console.warn('⚠️  DUCKDNS_DOMAIN not configured for production!');
            console.warn('   Please set DUCKDNS_DOMAIN=yourdomain.duckdns.org');
            return false;
        }
        
        return true;
    }
}

module.exports = Environment;