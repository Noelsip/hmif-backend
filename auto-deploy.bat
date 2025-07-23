@echo off
setlocal enabledelayedexpansion
echo 🚀 HMIF Backend Auto Deploy
echo ══════════════════════════════

echo 🔍 Checking Docker and Docker Compose...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker not found! Please install Docker Desktop first.
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose not found! Please install Docker Desktop with Compose.
    pause
    exit /b 1
)

echo 📝 Checking environment files...
if not exist .env (
    if exist .env.example (
        echo 🔧 Creating .env from template...
        copy .env.example .env >nul
        echo ⚠️  Please edit .env file with your actual configuration!
    ) else (
        echo ❌ No .env file found! Please create one from .env.example
        pause
        exit /b 1
    )
)

echo 🛑 Stopping existing services...
docker compose down --volumes --remove-orphans

echo 🧹 Cleaning Docker resources...
docker system prune -f

echo 🌐 Generating network configuration...
if exist docker-auto-env.js (
    node docker-auto-env.js
) else (
    echo 📝 Creating network config...
    call :create_network_config
)

echo 🔥 Setting up Windows Firewall...
netsh advfirewall firewall delete rule name="HMIF Backend" >nul 2>&1
netsh advfirewall firewall delete rule name="HMIF MySQL" >nul 2>&1
netsh advfirewall firewall delete rule name="HMIF Redis" >nul 2>&1
netsh advfirewall firewall add rule name="HMIF Backend" dir=in action=allow protocol=TCP localport=3000 profile=any
netsh advfirewall firewall add rule name="HMIF MySQL" dir=in action=allow protocol=TCP localport=3306 profile=any
netsh advfirewall firewall add rule name="HMIF Redis" dir=in action=allow protocol=TCP localport=6379 profile=any

echo 🐳 Building and starting databases first...
docker compose up mysql redis -d

echo ⏳ Waiting for databases to be ready...
call :wait_for_databases

echo 🚀 Starting application...
docker compose up app -d

echo ⏳ Waiting for application to be healthy...
call :wait_for_app_health

echo 🧪 Final verification...
call :verify_all_services

echo 🌐 Getting network information...
call :get_network_info

echo.
echo ✅ Deploy Complete! All services are running:
echo ══════════════════════════════════════════════
echo 🗄️ MySQL Database:   %LOCAL_IP%:3306
echo 📦 Redis Cache:      %LOCAL_IP%:6379  
echo 🌐 App Server:       %LOCAL_IP%:3000
echo.
echo 📱 Access from any device on your network:
echo    🏠 Main App:      http://%LOCAL_IP%:3000
echo    ❤️  Health Check: http://%LOCAL_IP%:3000/health
echo    📋 API Docs:      http://%LOCAL_IP%:3000/docs
echo    🔐 Auth Google:   http://%LOCAL_IP%:3000/auth/google
echo.
echo 🔧 Management Commands:
echo    docker compose logs app      - View app logs
echo    docker compose logs mysql    - View MySQL logs  
echo    docker compose logs redis    - View Redis logs
echo    docker compose logs -f       - Follow all logs
echo    docker compose restart app   - Restart app only
echo    docker compose down          - Stop all services
echo.
echo 📊 Service Status:
docker compose ps
echo.
pause
goto :eof

:create_network_config
echo const os = require('os'); > docker-auto-env.js
echo const fs = require('fs'); >> docker-auto-env.js
echo const interfaces = os.networkInterfaces(); >> docker-auto-env.js
echo let hostIP = 'localhost'; >> docker-auto-env.js
echo for (const name of Object.keys(interfaces)) { >> docker-auto-env.js
echo   for (const iface of interfaces[name]) { >> docker-auto-env.js
echo     if (iface.family === 'IPv4' ^&^& !iface.internal ^&^& iface.address.startsWith('192.168')) { >> docker-auto-env.js
echo       hostIP = iface.address; break; >> docker-auto-env.js
echo     } >> docker-auto-env.js
echo   } >> docker-auto-env.js
echo } >> docker-auto-env.js
echo const config = `HOST_IP=${hostIP}\nNETWORK_SUBNET=172.20.0\nEXTERNAL_URL=http://${hostIP}:3000\nFRONTEND_URL=http://${hostIP}:3000`; >> docker-auto-env.js
echo fs.writeFileSync('.env.docker', config); >> docker-auto-env.js
echo console.log('✅ Network config generated for IP:', hostIP); >> docker-auto-env.js
goto :eof

:wait_for_databases
echo 🔄 Waiting for MySQL and Redis to be healthy...
set /a timeout_counter=0
set /a max_timeout=180

:db_health_loop
docker compose ps --format "table {{.Service}}\t{{.Status}}" | findstr "mysql.*healthy" >nul
set mysql_healthy=%errorlevel%

docker compose ps --format "table {{.Service}}\t{{.Status}}" | findstr "redis.*healthy" >nul
set redis_healthy=%errorlevel%

if %mysql_healthy% equ 0 if %redis_healthy% equ 0 (
    echo ✅ Both databases are healthy!
    goto :eof
)

set /a timeout_counter+=10
if !timeout_counter! geq !max_timeout! (
    echo ⚠️ Timeout waiting for databases
    docker compose logs --tail 10 mysql
    docker compose logs --tail 10 redis
    goto :eof
)

if %mysql_healthy% neq 0 echo ⏳ MySQL not ready yet...
if %redis_healthy% neq 0 echo ⏳ Redis not ready yet...
echo ⏳ Waiting... (!timeout_counter!/!max_timeout!s^)
timeout /t 10 /nobreak >nul
goto db_health_loop

:wait_for_app_health
echo 🔄 Waiting for application to be healthy...
set /a timeout_counter=0
set /a max_timeout=300

:app_health_loop
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Application is healthy!
    goto :eof
)

set /a timeout_counter+=15
if !timeout_counter! geq !max_timeout! (
    echo ⚠️ Timeout waiting for application
    docker compose logs --tail 20 app
    goto :eof
)

echo ⏳ Application starting... (!timeout_counter!/!max_timeout!s^)
timeout /t 15 /nobreak >nul
goto app_health_loop

:verify_all_services
echo 🧪 Final service verification...

echo 🔍 MySQL verification...
docker compose exec -T mysql mysqladmin ping -h 127.0.0.1 -u root -prootpassword --silent
if %errorlevel% equ 0 (
    echo ✅ MySQL is operational
) else (
    echo ⚠️ MySQL verification failed
)

echo 🔍 Redis verification...
docker compose exec -T redis redis-cli ping
if %errorlevel% equ 0 (
    echo ✅ Redis is operational
) else (
    echo ⚠️ Redis verification failed
)

echo 🔍 Application verification...
curl -s http://localhost:3000/health
if %errorlevel% equ 0 (
    echo ✅ Application is operational
) else (
    echo ⚠️ Application verification failed
)
goto :eof

:get_network_info
echo 🌐 Detecting network information...
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4" ^| findstr "192.168"') do set LOCAL_IP=%%i
set LOCAL_IP=%LOCAL_IP: =%
if "%LOCAL_IP%"=="" set LOCAL_IP=localhost
goto :eof