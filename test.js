const http = require('http');

const baseUrl = 'http://10.160.132.109:3000';
const tests = [
    '/health',
    '/network-test', 
    '/docs',
    '/api-docs.json',
    '/api/subject'
];

async function testEndpoint(path) {
    return new Promise((resolve) => {
        const req = http.request(`${baseUrl}${path}`, { timeout: 5000 }, (res) => {
            resolve({ 
                path, 
                status: res.statusCode, 
                success: res.statusCode < 400,
                contentType: res.headers['content-type']
            });
        });
        
        req.on('error', () => resolve({ path, status: 'ERROR', success: false }));
        req.on('timeout', () => resolve({ path, status: 'TIMEOUT', success: false }));
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing Universal Device Access...\n');
    
    for (const path of tests) {
        const result = await testEndpoint(path);
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${path}: ${result.status} ${result.contentType || ''}`);
    }
    
    console.log('\n📱 Test these URLs from any device:');
    tests.forEach(path => {
        console.log(`   ${baseUrl}${path}`);
    });
}

runTests();