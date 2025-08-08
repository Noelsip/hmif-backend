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

# 📝 Cek .env file
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "🔧 Membuat .env dari template..."
        cp .env.example .env
        echo "⚠️  Edit file .env dengan konfigurasi yang sesuai!"
    fi
fi

# 📝 Buat .env.docker jika tidak ada
if [ ! -f ".env.docker" ]; then
    echo "🔧 Membuat .env.docker untuk Docker deployment..."
    LOCAL_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    
    cat > .env.docker << 'EOF'
# Docker Production Environment
HOST_IP=AUTO_DETECT
NETWORK_SUBNET=172.20.0
SERVER_HOST=0.0.0.0
EXTERNAL_URL=AUTO_DETECT
FRONTEND_URL=AUTO_DETECT

# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration (Docker internal services)
DATABASE_URL=mysql://root:rootpassword@mysql:3306/hmif_app
REDIS_URL=redis://redis:6379

# JWT Configuration - CHANGE THESE IN PRODUCTION!
JWT_SECRET=your-production-jwt-secret-here
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-production-refresh-secret-here
REFRESH_TOKEN_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=your-production-session-secret-here

# Google OAuth Configuration - ADD YOUR CREDENTIALS!
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# ImageKit Configuration - ADD YOUR CREDENTIALS!
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key_here
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key_here
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id

# Admin Configuration
ADMIN_EMAILS=admin@yourdomain.com

# Logging
LOG_LEVEL=info
EOF
    
    echo "✅ File .env.docker dibuat dengan template default"
fi

# 🛑 Stop service lama
echo "🛑 Menghentikan service lama..."
docker compose down --volumes --remove-orphans 2>/dev/null || true

# 🧹 Bersihkan resource docker yang conflict
echo "🧹 Membersihkan Docker networks dan resources..."
# Remove specific networks that might conflict
docker network rm hmif-backend_hmif-network 2>/dev/null || true
docker network rm hmif_network 2>/dev/null || true
docker network rm hmif-network 2>/dev/null || true

# Clean up unused networks
docker network prune -f

# Clean up other unused resources
docker system prune -f

# 🌐 Generate network config jika ada script
if [ -f "docker-auto-env.js" ]; then
    echo "🌐 Menggenerate konfigurasi network..."
    node docker-auto-env.js
else
    echo "🌐 Membuat script auto network config..."
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

// Read existing .env.docker and update AUTO_DETECT values
let envContent = '';
if (fs.existsSync('.env.docker')) {
    envContent = fs.readFileSync('.env.docker', 'utf8');
    
    // Replace AUTO_DETECT values
    envContent = envContent.replace(/HOST_IP=AUTO_DETECT/g, `HOST_IP=${hostIP}`);
    envContent = envContent.replace(/EXTERNAL_URL=AUTO_DETECT/g, `EXTERNAL_URL=http://${hostIP}:3000`);
    envContent = envContent.replace(/FRONTEND_URL=AUTO_DETECT/g, `FRONTEND_URL=http://${hostIP}:3000`);
    envContent = envContent.replace(/GOOGLE_CALLBACK_URL=http:\/\/localhost:3000\/auth\/google\/callback/g, `GOOGLE_CALLBACK_URL=http://${hostIP}:3000/auth/google/callback`);
    
    fs.writeFileSync('.env.docker', envContent);
}

console.log('✅ Network config updated for IP:', hostIP);
EOF
    
    node docker-auto-env.js
fi

# 🔨 Build dan jalankan container
echo "🔨 Building dan menjalankan container..."
docker compose up -d --build

echo "🎉 Deploy selesai!"
echo "📱 Aplikasi berjalan di: http://$(hostname -I | awk '{print $1}'):3000"
echo "📊 Cek status: docker compose ps"
echo "📋 Cek logs: docker compose logs -f"