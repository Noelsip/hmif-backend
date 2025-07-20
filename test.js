const http = require('http');
const https = require('https');
const NetworkUtils = require('./utils/network');

const networkInfo = NetworkUtils.getNetworkInfo();
const PORT = process.env.PORT || 3000;

console.log('🌐 Network Connectivity Test');
console.log('═'.repeat(50));

const endpoints = [
    { name: 'Health Check', url: `http://${networkInfo.ip}:${PORT}/health` },
    { name: 'Network Info', url: `http://${networkInfo.ip}:${PORT}/network-info` },
    { name: 'API Docs JSON', url: `http://${networkInfo.ip}:${PORT}/api-docs.json` },
    { name: 'Custom Docs', url: `http://${networkInfo.ip}:${PORT}/docs` },
    { name: 'Swagger UI', url: `http://${networkInfo.ip}:${PORT}/docs-swagger` },
];

async function testEndpoint(endpoint) {
    return new Promise((resolve) => {
        const protocol = endpoint.url.startsWith('https') ? https : http;
        
        const req = protocol.get(endpoint.url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    name: endpoint.name,
                    url: endpoint.url,
                    status: res.statusCode,
                    success: res.statusCode >= 200 && res.statusCode < 400,
                    size: data.length,
                    contentType: res.headers['content-type'] || 'unknown'
                });
            });
        });
        
        req.on('error', (error) => {
            resolve({
                name: endpoint.name,
                url: endpoint.url,
                success: false,
                error: error.message
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                name: endpoint.name,
                url: endpoint.url,
                success: false,
                error: 'Request timeout'
            });
        });
    });
}

async function runTests() {
    console.log(`Testing server at: ${networkInfo.ip}:${PORT}\n`);
    
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint);
        
        if (result.success) {
            console.log(`✅ ${result.name}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Status: ${result.status}`);
            console.log(`   Size: ${result.size} bytes`);
            console.log(`   Type: ${result.contentType}`);
        } else {
            console.log(`❌ ${result.name}`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Error: ${result.error}`);
        }
        console.log('');
    }
    
    console.log('🔗 URLs to try from other devices:');
    console.log(`   Main API: http://${networkInfo.ip}:${PORT}`);
    console.log(`   Health: http://${networkInfo.ip}:${PORT}/health`);
    console.log(`   Documentation: http://${networkInfo.ip}:${PORT}/docs`);
    console.log(`   Network Info: http://${networkInfo.ip}:${PORT}/network-info`);
    
    console.log('\n💡 If still having issues:');
    console.log('   1. Check Windows Firewall');
    console.log('   2. Try different browser/device');
    console.log('   3. Use incognito/private mode');
    console.log('   4. Clear browser cache');
}

runTests().catch(console.error);