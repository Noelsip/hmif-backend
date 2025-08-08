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
    else
        echo "❌ Tidak ada file .env! Buat dari .env.example"
        exit 1
    fi
fi

# 🛑 Stop service lama
echo "🛑 Menghentikan service lama..."
docker compose down --volumes --remove-orphans

# 🧹 Bersihkan resource docker
echo "🧹 Membersihkan resource Docker..."
docker system prune -f

# 🌐 Generate network config
if [ -f "docker-auto-env.js" ]; then
    node docker-auto-env.js
else
    echo "📝 Membuat konfigurasi network..."
    cat <<EOF > docker-auto-env.js
const os = require('os');
const fs = require('fs');
const interfaces = os.networkInterfaces();
let hostIP = 'localhost';
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168')) {
      hostIP = iface.address; break;
    }
  }
}
const config = \`HOST_IP=\${hostIP}\nNETWORK_SUBNET=172.20.0\nEXTERNAL_URL=http://\${hostIP}:3000\nFRONTEND_URL=http://\${hostIP}:3000\`;
fs.writeFileSync('.env.docker', config);
console.log('✅ Network config generated for IP:', hostIP);
EOF
    node docker-auto-env.js
fi

# 🔥 Firewall setup (opsional, hanya jika ufw aktif)
if command -v ufw &> /dev/null; then
    echo "🔥 Mengatur firewall..."
    ufw allow 3000
    ufw allow 3306
    ufw allow 6379
fi

# 🐳 Build dan start database
echo "🐳 Menjalankan MySQL & Redis..."
docker compose up mysql redis -d

# ⏳ Tunggu database ready
echo "⏳ Menunggu database siap..."
for i in {1..18}; do
    mysql_status=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep mysql | grep healthy || true)
    redis_status=$(docker compose ps --format '{{.Service}} {{.Status}}' | grep redis | grep healthy || true)

    if [[ $mysql_status && $redis_status ]]; then
        echo "✅ MySQL & Redis sehat!"
        break
    fi
    echo "⏳ Waiting for DBs... ($((i*10))s)"
    sleep 10
done

# 🚀 Start app
echo "🚀 Menjalankan aplikasi..."
docker compose up app -d

# ⏳ Health check aplikasi
echo "⏳ Menunggu aplikasi sehat..."
for i in {1..20}; do
    if curl -s http://localhost:3000/health > /dev/null; then
        echo "✅ Aplikasi sehat!"
        break
    fi
    echo "⏳ Waiting app... ($((i*15))s)"
    sleep 15
done

# 🧪 Verifikasi service
echo "🧪 Verifikasi MySQL..."
docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -u root -prootpassword --silent && echo "✅ MySQL OK" || echo "⚠️ MySQL gagal"

echo "🧪 Verifikasi Redis..."
docker compose exec -T redis redis-cli ping && echo "✅ Redis OK" || echo "⚠️ Redis gagal"

echo "🧪 Verifikasi aplikasi..."
curl -s http://localhost:3000/health && echo "✅ App OK" || echo "⚠️ App gagal"

# 🌐 Info network
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo
echo "✅ Deploy Complete!"
echo "══════════════════════════════════════════════"
echo "🗄️ MySQL:   $LOCAL_IP:3306"
echo "📦 Redis:   $LOCAL_IP:6379"
echo "🌐 App:     $LOCAL_IP:3000"
echo
echo "🏠 Main App:      http://$LOCAL_IP:3000"
echo "❤️  Health Check: http://$LOCAL_IP:3000/health"
echo "📋 API Docs:      http://$LOCAL_IP:3000/docs"
echo "🔐 Auth Google:   http://$LOCAL_IP:3000/auth/google"
echo
docker compose ps
