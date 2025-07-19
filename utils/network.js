const os = require('os');

class NetworkUtils {
    static getLocalIP() {
        const interfaces = os.networkInterfaces();
        
        // Priority order for network interfaces
        const priorityOrder = [
            'wi-fi', 'wireless', 'wlan', 'wifi',
            'ethernet', 'eth', 'en0', 'en1',
            'local area connection', 'vethernet'
        ];
        
        // First try to find preferred interface
        for (const priority of priorityOrder) {
            for (const [name, ifaces] of Object.entries(interfaces)) {
                if (name.toLowerCase().includes(priority)) {
                    for (const iface of ifaces) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            return {
                                ip: iface.address,
                                interface: name,
                                priority: true
                            };
                        }
                    }
                }
            }
        }
        
        // Fallback to any non-internal IPv4
        for (const [name, ifaces] of Object.entries(interfaces)) {
            for (const iface of ifaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return {
                        ip: iface.address,
                        interface: name,
                        priority: false
                    };
                }
            }
        }
        
        return { ip: 'localhost', interface: 'loopback', priority: false };
    }
    
    static getNetworkInfo() {
        const ipInfo = this.getLocalIP();
        const ip = ipInfo.ip;
        
        if (ip === 'localhost') {
            return {
                ip: 'localhost',
                subnet: 'localhost',
                networkClass: 'loopback',
                isPrivate: true,
                interface: 'loopback'
            };
        }
        
        const parts = ip.split('.');
        const subnet = parts.slice(0, 3).join('.');
        
        return {
            ip,
            subnet,
            interface: ipInfo.interface,
            networkClass: this.getNetworkClass(ip),
            isPrivate: this.isPrivateIP(ip),
            gateway: this.getDefaultGateway(subnet),
            broadcast: `${subnet}.255`
        };
    }
    
    static getNetworkClass(ip) {
        const firstOctet = parseInt(ip.split('.')[0]);
        if (firstOctet >= 1 && firstOctet <= 126) return 'A';
        if (firstOctet >= 128 && firstOctet <= 191) return 'B';
        if (firstOctet >= 192 && firstOctet <= 223) return 'C';
        return 'Unknown';
    }
    
    static isPrivateIP(ip) {
        const parts = ip.split('.').map(Number);
        return (
            (parts[0] === 10) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
        );
    }
    
    static getDefaultGateway(subnet) {
        return `${subnet}.1`;
    }
    
    // Generate dynamic CORS origins based on current network
    static generateCorsOrigins(port = 3000) {
        const networkInfo = this.getNetworkInfo();
        const origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            `http://localhost:${port}`,
            `http://127.0.0.1:${port}`
        ];
        
        if (networkInfo.ip !== 'localhost') {
            origins.push(`http://${networkInfo.ip}:${port}`);
            
            // Add common frontend ports
            [3000, 3001, 4200, 5173, 8080, 8081].forEach(p => {
                origins.push(`http://${networkInfo.ip}:${p}`);
            });
            
            // Add subnet range for local network devices
            for (let i = 1; i <= 254; i++) {
                origins.push(`http://${networkInfo.subnet}.${i}:${port}`);
            }
        }
        
        return origins;
    }
    
    // Generate environment variables for Docker
    static generateDockerEnv(port = 3000) {
        const networkInfo = this.getNetworkInfo();
        
        return {
            HOST_IP: networkInfo.ip,
            NETWORK_SUBNET: networkInfo.subnet,
            CORS_ORIGINS: this.generateCorsOrigins(port).join(','),
            GOOGLE_CALLBACK_URL: `http://${networkInfo.ip}:${port}/auth/google/callback`,
            SWAGGER_HOST: networkInfo.ip,
            SERVER_HOST: '0.0.0.0', // Always bind to all interfaces in Docker
            EXTERNAL_URL: `http://${networkInfo.ip}:${port}`
        };
    }
}

module.exports = NetworkUtils;