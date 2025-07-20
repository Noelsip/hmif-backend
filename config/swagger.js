const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const NetworkUtils = require('../utils/network');

const networkInfo = NetworkUtils.getNetworkInfo();
const PORT = process.env.PORT || 3000;

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HMIF Backend API',
            version: '1.0.0',
            description: 'API documentation for HMIF App Backend'
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Local development server'
            },
            {
                url: `http://${networkInfo.ip}:${PORT}`,
                description: 'Network server'
            }
        ],
        // ...existing schemas...
    },
    apis: ['./routes/*.js', './app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

// SOLUSI: Custom HTML tanpa dependency external
const generateSwaggerHTML = (host) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HMIF API Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #fafafa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 30px; }
        .endpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 6px; background: #f9f9f9; }
        .method { display: inline-block; font-weight: bold; color: white; padding: 6px 12px; border-radius: 4px; margin-right: 10px; font-size: 12px; }
        .get { background-color: #61affe; }
        .post { background-color: #49cc90; }
        .put { background-color: #fca130; }
        .delete { background-color: #f93e3e; }
        .path { font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #333; }
        .description { margin: 10px 0; color: #666; }
        .test-btn { background: #4CAF50; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        .test-btn:hover { background: #45a049; }
        .result { margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 4px; border-left: 4px solid #4CAF50; display: none; }
        .result pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 12px; }
        .servers { margin: 20px 0; }
        .server-item { background: #e8f4fd; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 4px solid #61affe; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .tabs { margin: 20px 0; }
        .tab-btn { background: #f1f1f1; border: none; padding: 10px 20px; margin-right: 5px; cursor: pointer; border-radius: 4px 4px 0 0; }
        .tab-btn.active { background: #61affe; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 HMIF Backend API Documentation</h1>
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Description:</strong> API documentation for HMIF App Backend</p>
        </div>
        
        <div class="servers">
            <h3>🌐 Available Servers:</h3>
            <div class="server-item">
                <strong>Network Server:</strong> <code>http://${host}</code>
            </div>
            <div class="server-item">
                <strong>Local Server:</strong> <code>http://localhost:${PORT}</code>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="openTab(event, 'endpoints')">📋 Endpoints</button>
            <button class="tab-btn" onclick="openTab(event, 'auth')">🔐 Authentication</button>
            <button class="tab-btn" onclick="openTab(event, 'schemas')">📊 Schemas</button>
        </div>

        <div id="endpoints" class="tab-content active">
            <h3>📋 API Endpoints</h3>
            
            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/health</span>
                <div class="description">Health check endpoint - Returns server status</div>
                <button class="test-btn" onclick="testEndpoint('GET', '/health', null)">🧪 Test</button>
                <div class="result" id="result-health"></div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/network-info</span>
                <div class="description">Get network information and available endpoints</div>
                <button class="test-btn" onclick="testEndpoint('GET', '/network-info', null)">🧪 Test</button>
                <div class="result" id="result-network-info"></div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/auth/google</span>
                <div class="description">Initiate Google OAuth authentication</div>
                <button class="test-btn" onclick="window.open('/auth/google', '_blank')">🔗 Open</button>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/subjects</span>
                <div class="description">Get all subjects with pagination</div>
                <button class="test-btn" onclick="testEndpoint('GET', '/api/subjects', null)">🧪 Test</button>
                <div class="result" id="result-subjects"></div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/news</span>
                <div class="description">Get all published news articles</div>
                <button class="test-btn" onclick="testEndpoint('GET', '/api/news', null)">🧪 Test</button>
                <div class="result" id="result-news"></div>
            </div>

            <div class="endpoint">
                <span class="method get">GET</span>
                <span class="path">/api/videos</span>
                <div class="description">Get all learning videos</div>
                <button class="test-btn" onclick="testEndpoint('GET', '/api/videos', null)">🧪 Test</button>
                <div class="result" id="result-videos"></div>
            </div>
        </div>

        <div id="auth" class="tab-content">
            <h3>🔐 Authentication</h3>
            <p>This API uses the following authentication methods:</p>
            <ul>
                <li><strong>Bearer Token:</strong> Include <code>Authorization: Bearer YOUR_TOKEN</code> in headers</li>
                <li><strong>Cookie Auth:</strong> Session-based authentication via cookies</li>
                <li><strong>Google OAuth:</strong> OAuth 2.0 via Google</li>
            </ul>
        </div>

        <div id="schemas" class="tab-content">
            <h3>📊 Data Schemas</h3>
            <div class="endpoint">
                <h4>User Schema</h4>
                <pre>{
  "id": "integer",
  "email": "string",
  "name": "string", 
  "profilePicture": "string",
  "isAdmin": "boolean",
  "createdAt": "date-time"
}</pre>
            </div>
            
            <div class="endpoint">
                <h4>Subject Schema</h4>
                <pre>{
  "id": "integer",
  "code": "string",
  "name": "string",
  "description": "string",
  "semester": "integer",
  "credits": "integer"
}</pre>
            </div>
        </div>
    </div>

    <script>
        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tab-content");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].classList.remove("active");
            }
            tablinks = document.getElementsByClassName("tab-btn");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].classList.remove("active");
            }
            document.getElementById(tabName).classList.add("active");
            evt.currentTarget.classList.add("active");
        }

        async function testEndpoint(method, endpoint, body) {
            const resultId = 'result-' + endpoint.replace(/[^a-zA-Z0-9]/g, '');
            const resultDiv = document.getElementById(resultId) || document.getElementById('result-health');
            
            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    }
                };
                
                if (body) {
                    options.body = JSON.stringify(body);
                }
                
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<pre>⏳ Loading...</pre>';
                
                const response = await fetch(endpoint, options);
                const data = await response.json();
                
                resultDiv.innerHTML = \`
                    <strong>Status:</strong> \${response.status} \${response.statusText}<br>
                    <strong>Response:</strong>
                    <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
                
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = \`
                    <strong>❌ Error:</strong>
                    <pre>\${error.message}</pre>
                \`;
            }
        }
        
        // Auto-test health endpoint on load
        window.onload = function() {
            testEndpoint('GET', '/health', null);
        };
    </script>
</body>
</html>`;
};

module.exports = {
    swaggerUi,
    swaggerSpec,
    generateSwaggerHTML
};