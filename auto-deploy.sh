#!/bin/bash
set -e

echo "🚀 HMIF Backend Auto Deploy"
echo "══════════════════════════════"

# 🔍 Cek Docker dan Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker tidak ditemukan! Install Docker terlebih dahulu."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose tidak ditemukan! Pastikan versi Docker mendukung compose plugin."
    exit 1
fi

# 📝 Validate package.json
if ! node -e "JSON.parse(require('fs').readFileSync('package.json'))" 2>/dev/null; then
    echo "❌ package.json tidak valid atau tidak ditemukan!"
    exit 1
fi

# 🧹 Complete cleanup
echo "🧹 Melakukan pembersihan menyeluruh..."
docker compose down --volumes --remove-orphans 2>/dev/null || true

# Remove any conflicting networks
docker network rm hmif-backend_hmif-network 2>/dev/null || true
docker network rm hmif_network 2>/dev/null || true
docker network rm hmif-network 2>/dev/null || true

# Clean up unused resources
docker system prune -f
docker volume prune -f

# 🌐 Update network configuration
echo "🌐 Mengkonfigurasi network..."
if [ ! -f "docker-auto-env.js" ]; then
    cat > docker-auto-env.js << 'EOF'
const os = require('os');
const fs = require('fs');

// Get network interfaces
const interfaces = os.networkInterfaces();
let hostIP = 'localhost';

// Find the first non-internal IPv4 address
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            hostIP = iface.address;
            break;
        }
    }
    if (hostIP !== 'localhost') break;
}

console.log('🌐 Detected IP:', hostIP);

// Update .env.docker if exists
if (fs.existsSync('.env.docker')) {
    let envContent = fs.readFileSync('.env.docker', 'utf8');
    
    // Update IP-related configurations
    envContent = envContent.replace(/HOST_IP=.*/g, `HOST_IP=${hostIP}`);
    envContent = envContent.replace(/EXTERNAL_URL=.*/g, `EXTERNAL_URL=http://${hostIP}:3000`);
    envContent = envContent.replace(/FRONTEND_URL=.*/g, `FRONTEND_URL=http://${hostIP}:3000`);
    envContent = envContent.replace(/GOOGLE_CALLBACK_URL=http:\/\/[^\/]+:3000/g, `GOOGLE_CALLBACK_URL=http://${hostIP}:3000`);
    envContent = envContent.replace(/SWAGGER_HOST=.*/g, `SWAGGER_HOST=${hostIP}`);
    
    fs.writeFileSync('.env.docker', envContent);
    console.log('✅ Updated .env.docker with IP:', hostIP);
}
EOF
fi

node docker-auto-env.js

# 📋 Validate .env.docker
if [ ! -f ".env.docker" ]; then
    echo "❌ .env.docker tidak ditemukan!"
    exit 1
fi

# 🔨 Build dengan no cache untuk memastikan fresh install
echo "🔨 Building aplikasi dengan fresh dependencies..."
docker compose build --no-cache --pull

# 🚀 Start services dengan proper wait
echo "🚀 Memulai services..."
docker compose up -d

# ⏳ Wait untuk services ready
echo "⏳ Menunggu services siap..."
sleep 10

# 🏥 Health check
echo "🏥 Melakukan health check..."
for i in {1..12}; do
    if docker compose ps | grep -q "Up.*healthy\|Up.*starting"; then
        echo "✅ Services berhasil dimulai!"
        break
    elif [ $i -eq 12 ]; then
        echo "❌ Services gagal dimulai setelah 60 detik"
        echo "📋 Cek logs untuk detail error:"
        docker compose logs --tail 20
        exit 1
    else
        echo "⏳ Tunggu... ($i/12)"
        sleep 5
    fi
done

# 📊 Final status
echo ""
echo "🎉 Deploy berhasil!"
echo "📱 Aplikasi: http://$(hostname -I | awk '{print $1}'):3000"
echo "📊 Status: docker compose ps"
echo "📋 Logs: docker compose logs -f app"
echo ""
docker compose ps