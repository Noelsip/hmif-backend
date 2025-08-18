const os = require('os');

class NetworkUtils {
    static getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        let ip = '127.0.0.1';
        
        // Try to find external IP
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    ip = net.address;
                    break;
                }
            }
        }
        
        // Fallback to VPS IP if available
        if (process.env.VPS_IP) {
            ip = process.env.VPS_IP;
        }
        
        return {
            ip: ip,
            interface: 'auto-detected',
            subnet: ip.substring(0, ip.lastIndexOf('.'))
        };
    }
    
    static generateDockerEnv(port = 3000) {
        const networkInfo = this.getNetworkInfo();
        
        return {
            PORT: port,
            NODE_ENV: 'production',
            VPS_IP: networkInfo.ip,
            HOST_IP: networkInfo.ip,
            SERVER_HOST: '0.0.0.0'
        };
    }
}

module.exports = NetworkUtils;