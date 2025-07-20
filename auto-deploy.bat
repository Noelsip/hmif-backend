@echo off
echo 🚀 HMIF Backend Network Fix Deploy
echo ═══════════════════════════════════

echo 🛑 Stopping containers...
docker-compose down

echo 🧹 Cleaning Docker...
docker system prune -f

echo 🌐 Generating network config...
node docker-auto-env.js

echo 🔥 Setting up Windows Firewall...
netsh advfirewall firewall delete rule name="HMIF Backend" >nul 2>&1
netsh advfirewall firewall add rule name="HMIF Backend" dir=in action=allow protocol=TCP localport=3000 profile=any

echo 📦 Building containers...
docker-compose up --build -d

echo ⏳ Waiting for services...
timeout /t 30

echo 🧪 Testing network connectivity...
node test-network.js

echo.
echo ✅ Deploy complete!
echo.
echo 📱 Test these URLs from other devices:
for /f "tokens=2 delims==" %%i in ('findstr "HOST_IP" .env.docker') do (
    echo    📋 Documentation: http://%%i:3000/docs
    echo    ❤️  Health Check: http://%%i:3000/health
    echo    🌐 Network Info: http://%%i:3000/network-info
)
echo.
pause