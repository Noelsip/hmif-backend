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
            description: 'Complete API documentation for HMIF App Backend - Academic Learning Management System',
            contact: {
                name: 'HMIF Development Team',
                email: 'dev@hmif.itk.ac.id'
            }
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
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'connect.sid'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        googleId: { type: 'string', example: '1234567890' },
                        email: { type: 'string', format: 'email', example: '11231072@student.itk.ac.id' },
                        name: { type: 'string', example: 'John Doe' },
                        picture: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' },
                        nim: { type: 'string', example: '11231072' },
                        role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
                        isActive: { type: 'boolean', example: true },
                        lastLogin: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Subject: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        code: { type: 'string', example: 'IF101' },
                        name: { type: 'string', example: 'Algoritma dan Pemrograman' },
                        description: { type: 'string', example: 'Mata kuliah dasar pemrograman' },
                        semester: { type: 'integer', example: 1 },
                        credits: { type: 'integer', example: 3 },
                        isActive: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        learningVideos: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/LearningVideo' }
                        }
                    }
                },
                LearningVideo: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        subjectId: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Pengenalan Algoritma' },
                        description: { type: 'string', example: 'Video pembelajaran tentang konsep dasar algoritma' },
                        videoUrl: { type: 'string', format: 'uri', example: 'https://youtube.com/watch?v=example' },
                        duration: { type: 'integer', example: 1800, description: 'Duration in seconds' },
                        orderIndex: { type: 'integer', example: 1 },
                        thumbnailUrl: { type: 'string', format: 'uri', example: 'https://img.youtube.com/vi/example/0.jpg' },
                        isActive: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        subject: { $ref: '#/components/schemas/Subject' }
                    }
                },
                VideoProgress: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        userId: { type: 'integer', example: 1 },
                        videoId: { type: 'integer', example: 1 },
                        watchDuration: { type: 'integer', example: 900, description: 'Duration watched in seconds' },
                        isCompleted: { type: 'boolean', example: false },
                        lastWatchedAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                News: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Pengumuman Pendaftaran Kuliah' },
                        content: { type: 'string', example: 'Konten lengkap berita...' },
                        excerpt: { type: 'string', example: 'Ringkasan berita...' },
                        imageUrl: { type: 'string', format: 'uri', example: 'https://example.com/news-image.jpg' },
                        authorId: { type: 'integer', example: 1 },
                        category: { type: 'string', enum: ['GENERAL', 'ACADEMIC', 'EVENTS', 'ANNOUNCEMENTS'], example: 'GENERAL' },
                        tags: { type: 'string', example: 'kuliah,pendaftaran,mahasiswa' },
                        isPublished: { type: 'boolean', example: true },
                        isFeatured: { type: 'boolean', example: false },
                        views: { type: 'integer', example: 150 },
                        publishedAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        author: { $ref: '#/components/schemas/User' }
                    }
                },
                Announcement: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Libur Semester Genap' },
                        content: { type: 'string', example: 'Pengumuman libur semester...' },
                        type: { type: 'string', enum: ['INFO', 'WARNING', 'URGENT', 'MAINTENANCE'], example: 'INFO' },
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'MEDIUM' },
                        authorId: { type: 'integer', example: 1 },
                        targetAudience: { type: 'string', example: 'ALL' },
                        semester: { type: 'integer', example: null },
                        isActive: { type: 'boolean', example: true },
                        startDate: { type: 'string', format: 'date-time' },
                        endDate: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Event: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Workshop Flutter Development' },
                        description: { type: 'string', example: 'Workshop pengembangan aplikasi mobile dengan Flutter' },
                        location: { type: 'string', example: 'Lab Komputer A' },
                        imageUrl: { type: 'string', format: 'uri', example: 'https://example.com/event-banner.jpg' },
                        organizerId: { type: 'integer', example: 1 },
                        startDate: { type: 'string', format: 'date-time' },
                        endDate: { type: 'string', format: 'date-time' },
                        registrationStart: { type: 'string', format: 'date-time' },
                        registrationEnd: { type: 'string', format: 'date-time' },
                        maxParticipants: { type: 'integer', example: 50 },
                        currentParticipants: { type: 'integer', example: 25 },
                        isActive: { type: 'boolean', example: true },
                        requiresRegistration: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Achievement: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        userId: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Juara 1 Programming Competition' },
                        description: { type: 'string', example: 'Meraih juara 1 dalam kompetisi programming tingkat nasional' },
                        category: { type: 'string', enum: ['ACADEMIC', 'COMPETITION', 'ORGANIZATION', 'COMMUNITY_SERVICE', 'CERTIFICATION'], example: 'COMPETITION' },
                        badgeIcon: { type: 'string', format: 'uri', example: 'https://example.com/badge-gold.png' },
                        points: { type: 'integer', example: 100 },
                        issuedAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Gallery: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        title: { type: 'string', example: 'Workshop Mobile Development' },
                        description: { type: 'string', example: 'Dokumentasi kegiatan workshop mobile development' },
                        imageUrl: { type: 'string', format: 'uri', example: 'https://example.com/gallery-image.jpg' },
                        category: { type: 'string', enum: ['EVENT', 'ACADEMIC', 'COMPETITION', 'ORGANIZATION', 'GRADUATION', 'FACILITY'], example: 'EVENT' },
                        uploadedBy: { type: 'integer', example: 1 },
                        isActive: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                AppSettings: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        key: { type: 'string', example: 'maintenance_mode' },
                        value: { type: 'string', example: 'false' },
                        description: { type: 'string', example: 'Enable/disable maintenance mode' },
                        updatedBy: { type: 'integer', example: 1 },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                PaginationResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        data: { type: 'array', items: {} },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: { type: 'integer', example: 1 },
                                limit: { type: 'integer', example: 10 },
                                total: { type: 'integer', example: 100 },
                                totalPages: { type: 'integer', example: 10 },
                                hasNext: { type: 'boolean', example: true },
                                hasPrev: { type: 'boolean', example: false }
                            }
                        }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' },
                        error: { type: 'string', example: 'Detailed error information' },
                        requestId: { type: 'string', example: '1234567890' }
                    }
                }
            }
        },
        security: [
            { bearerAuth: [] },
            { cookieAuth: [] }
        ]
    },
    apis: ['./routes/*.js', './app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

// Custom HTML Documentation dengan semua endpoint
const generateSwaggerHTML = (host) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HMIF API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fa; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        
        .tabs { display: flex; margin-bottom: 20px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .tab-btn { flex: 1; padding: 15px 20px; border: none; background: white; cursor: pointer; font-size: 1rem; transition: all 0.3s; }
        .tab-btn:hover { background: #f8f9fa; }
        .tab-btn.active { background: #667eea; color: white; }
        
        .tab-content { display: none; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .tab-content.active { display: block; }
        
        .endpoint-group { margin-bottom: 40px; border: 1px solid #e9ecef; border-radius: 8px; overflow: hidden; }
        .endpoint-group h3 { background: #495057; color: white; padding: 15px 20px; margin: 0; font-size: 1.3rem; }
        .endpoint { padding: 20px; border-bottom: 1px solid #e9ecef; }
        .endpoint:last-child { border-bottom: none; }
        
        .method { display: inline-block; font-weight: bold; color: white; padding: 6px 12px; border-radius: 20px; margin-right: 15px; font-size: 12px; min-width: 60px; text-align: center; }
        .get { background: #28a745; }
        .post { background: #007bff; }
        .put { background: #ffc107; color: #212529; }
        .delete { background: #dc3545; }
        
        .path { font-family: 'Monaco', 'Courier New', monospace; font-size: 16px; font-weight: 600; color: #495057; margin-left: 10px; }
        .description { margin: 15px 0 10px 0; color: #6c757d; font-style: italic; }
        .params { margin: 15px 0; }
        .param { background: #f8f9fa; padding: 10px; margin: 5px 0; border-left: 4px solid #007bff; border-radius: 4px; }
        
        .test-btn { background: linear-gradient(45deg, #28a745, #20c997); color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin: 10px 5px 0 0; font-size: 14px; transition: all 0.3s; }
        .test-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3); }
        
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #28a745; display: none; }
        .result pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; max-height: 300px; overflow-y: auto; }
        
        .schema-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6f42c1; }
        .schema-title { font-weight: 600; color: #6f42c1; margin-bottom: 10px; font-size: 1.1rem; }
        
        .servers { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .server-item { background: linear-gradient(45deg, #e3f2fd, #f3e5f5); padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #2196f3; }
        
        .auth-info { background: linear-gradient(45deg, #fff3e0, #fce4ec); padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
        
        @media (max-width: 768px) {
            .container { padding: 10px; }
            .tabs { flex-direction: column; }
            .header h1 { font-size: 2rem; }
            .method { margin-bottom: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 HMIF Backend API Documentation</h1>
            <p><strong>Version:</strong> 1.0.0 | <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p>Complete API documentation for HMIF Academic Learning Management System</p>
        </div>
        
        <div class="servers">
            <h3>🌐 Available Servers</h3>
            <div class="server-item">
                <strong>🏠 Local Development:</strong> <code>http://localhost:${PORT}</code>
            </div>
            <div class="server-item">
                <strong>🌍 Network Access:</strong> <code>http://${host}</code>
            </div>
            <div class="server-item">
                <strong>📱 Mobile Testing:</strong> <code>http://10.0.2.2:${PORT}</code> (Android Emulator)
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="openTab(event, 'system')">🏠 System</button>
            <button class="tab-btn" onclick="openTab(event, 'auth')">🔐 Authentication</button>
            <button class="tab-btn" onclick="openTab(event, 'academic')">📚 Academic</button>
            <button class="tab-btn" onclick="openTab(event, 'content')">📰 Content</button>
            <button class="tab-btn" onclick="openTab(event, 'admin')">👨‍💼 Admin</button>
            <button class="tab-btn" onclick="openTab(event, 'schemas')">📊 Schemas</button>
        </div>

        <!-- System Endpoints -->
        <div id="system" class="tab-content active">
            <div class="endpoint-group">
                <h3>🏠 System & Health Check</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/</span>
                    <div class="description">API root endpoint - Returns basic API information</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/', null)">🧪 Test</button>
                    <div class="result" id="result-root"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/health</span>
                    <div class="description">Health check endpoint - Returns server status and service availability</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/health', null)">🧪 Test</button>
                    <div class="result" id="result-health"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/network-info</span>
                    <div class="description">Network information - Returns server network details and access URLs</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/network-info', null)">🧪 Test</button>
                    <div class="result" id="result-network"></div>
                </div>
            </div>
        </div>

        <!-- Authentication Endpoints -->
        <div id="auth" class="tab-content">
            <div class="auth-info">
                <h4>🔐 Authentication Methods</h4>
                <ul>
                    <li><strong>Google OAuth 2.0:</strong> Primary authentication method</li>
                    <li><strong>JWT Bearer Token:</strong> Include <code>Authorization: Bearer YOUR_TOKEN</code> in headers</li>
                    <li><strong>Session Cookies:</strong> Browser-based authentication</li>
                    <li><strong>Admin Access:</strong> Requires ADMIN role for admin endpoints</li>
                </ul>
            </div>

            <div class="endpoint-group">
                <h3>🔐 Authentication Routes</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/auth/google</span>
                    <div class="description">Initialize Google OAuth authentication flow</div>
                    <button class="test-btn" onclick="window.open('/auth/google', '_blank')">🔗 Open OAuth</button>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/auth/google</span>
                    <div class="description">Authenticate with Google ID token (for mobile apps)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> { "idToken": "google_id_token_here" }</div>
                    </div>
                    <button class="test-btn" onclick="testEndpoint('POST', '/auth/google', {idToken: 'example_token'})">🧪 Test</button>
                    <div class="result" id="result-auth-google"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/auth/google/callback</span>
                    <div class="description">Google OAuth callback endpoint</div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/auth/logout</span>
                    <div class="description">Logout current user session</div>
                    <button class="test-btn" onclick="testEndpoint('POST', '/auth/logout', null)">🧪 Test</button>
                    <div class="result" id="result-auth-logout"></div>
                </div>
            </div>
        </div>

        <!-- Academic Endpoints -->
        <div id="academic" class="tab-content">
            <div class="endpoint-group">
                <h3>📚 Subject Management</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/subjects</span>
                    <div class="description">Get all subjects with pagination and search</div>
                    <div class="params">
                        <div class="param"><strong>Query:</strong> page (int), limit (int), search (string), semester (int)</div>
                    </div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/subjects?page=1&limit=5', null)">🧪 Test</button>
                    <div class="result" id="result-subjects"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/subjects/{id}</span>
                    <div class="description">Get specific subject by ID with learning videos</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/subjects/1', null)">🧪 Test</button>
                    <div class="result" id="result-subject-detail"></div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/subjects</span>
                    <div class="description">Create new subject (Admin only)</div>
                    <div class="params">
                        <div class="param"><strong>Headers:</strong> Authorization: Bearer TOKEN</div>
                        <div class="param"><strong>Body:</strong> { "code": "IF101", "name": "Programming", "semester": 1, "credits": 3 }</div>
                    </div>
                </div>

                <div class="endpoint">
                    <span class="method put">PUT</span>
                    <span class="path">/api/subjects/{id}</span>
                    <div class="description">Update existing subject (Admin only)</div>
                </div>

                <div class="endpoint">
                    <span class="method delete">DELETE</span>
                    <span class="path">/api/subjects/{id}</span>
                    <div class="description">Delete subject (Admin only)</div>
                </div>
            </div>

            <div class="endpoint-group">
                <h3>🎥 Learning Videos</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/videos</span>
                    <div class="description">Get all learning videos with pagination</div>
                    <div class="params">
                        <div class="param"><strong>Query:</strong> page, limit, subjectId, search</div>
                    </div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/videos?page=1&limit=5', null)">🧪 Test</button>
                    <div class="result" id="result-videos"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/videos/{id}</span>
                    <div class="description">Get specific video by ID</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/videos/1', null)">🧪 Test</button>
                    <div class="result" id="result-video-detail"></div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/videos</span>
                    <div class="description">Create new learning video (Admin only)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> { "subjectId": 1, "title": "Video Title", "videoUrl": "https://...", "duration": 1800 }</div>
                    </div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/videos/{id}/progress</span>
                    <div class="description">Update video watch progress (Authenticated users)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> { "watchDuration": 900, "isCompleted": false }</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Content Management -->
        <div id="content" class="tab-content">
            <div class="endpoint-group">
                <h3>📰 News Management</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/news</span>
                    <div class="description">Get all published news articles</div>
                    <div class="params">
                        <div class="param"><strong>Query:</strong> page, limit, category, featured, search</div>
                    </div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/news?page=1&limit=3', null)">🧪 Test</button>
                    <div class="result" id="result-news"></div>
                </div>

                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/news/{id}</span>
                    <div class="description">Get specific news article (increments view count)</div>
                    <button class="test-btn" onclick="testEndpoint('GET', '/api/news/1', null)">🧪 Test</button>
                    <div class="result" id="result-news-detail"></div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/news</span>
                    <div class="description">Create new news article (Admin only)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> { "title": "News Title", "content": "Full content", "excerpt": "Summary", "category": "GENERAL" }</div>
                    </div>
                </div>
            </div>

            <div class="endpoint-group">
                <h3>📤 File Upload</h3>
                
                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/upload/image</span>
                    <div class="description">Upload image to ImageKit (Authenticated users)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> FormData with 'image' file</div>
                        <div class="param"><strong>Headers:</strong> Content-Type: multipart/form-data</div>
                    </div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/upload/video</span>
                    <div class="description">Upload video file (Admin only)</div>
                </div>
            </div>
        </div>

        <!-- Admin Endpoints -->
        <div id="admin" class="tab-content">
            <div class="endpoint-group">
                <h3>📢 Announcements</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/announcements</span>
                    <div class="description">Get active announcements</div>
                    <div class="params">
                        <div class="param"><strong>Query:</strong> type, priority, targetAudience</div>
                    </div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/announcements</span>
                    <div class="description">Create new announcement (Admin only)</div>
                    <div class="params">
                        <div class="param"><strong>Body:</strong> { "title": "Announcement", "content": "Content", "type": "INFO", "priority": "MEDIUM" }</div>
                    </div>
                </div>
            </div>

            <div class="endpoint-group">
                <h3>🎉 Events</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/events</span>
                    <div class="description">Get upcoming events</div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/events</span>
                    <div class="description">Create new event (Admin only)</div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/events/{id}/register</span>
                    <div class="description">Register for event (Authenticated users)</div>
                </div>
            </div>

            <div class="endpoint-group">
                <h3>🏆 Achievements</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/achievements</span>
                    <div class="description">Get user achievements</div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/achievements</span>
                    <div class="description">Award achievement to user (Admin only)</div>
                </div>
            </div>

            <div class="endpoint-group">
                <h3>🖼️ Gallery</h3>
                
                <div class="endpoint">
                    <span class="method get">GET</span>
                    <span class="path">/api/gallery</span>
                    <div class="description">Get gallery images</div>
                    <div class="params">
                        <div class="param"><strong>Query:</strong> category, page, limit</div>
                    </div>
                </div>

                <div class="endpoint">
                    <span class="method post">POST</span>
                    <span class="path">/api/gallery</span>
                    <div class="description">Upload gallery image (Admin only)</div>
                </div>
            </div>
        </div>

        <!-- Database Schemas -->
        <div id="schemas" class="tab-content">
            <h3>📊 Database Schemas</h3>
            
            <div class="schema-box">
                <div class="schema-title">👤 User Schema</div>
                <pre>{
  "id": 1,
  "googleId": "1234567890",
  "email": "11231072@student.itk.ac.id",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "nim": "11231072",
  "role": "USER" | "ADMIN",
  "isActive": true,
  "lastLogin": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}</pre>
            </div>

            <div class="schema-box">
                <div class="schema-title">📚 Subject Schema</div>
                <pre>{
  "id": 1,
  "code": "IF101",
  "name": "Algoritma dan Pemrograman",
  "description": "Mata kuliah dasar pemrograman",
  "semester": 1,
  "credits": 3,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "learningVideos": [LearningVideo]
}</pre>
            </div>

            <div class="schema-box">
                <div class="schema-title">🎥 Learning Video Schema</div>
                <pre>{
  "id": 1,
  "subjectId": 1,
  "title": "Pengenalan Algoritma",
  "description": "Video pembelajaran tentang konsep dasar algoritma",
  "videoUrl": "https://youtube.com/watch?v=example",
  "duration": 1800,
  "orderIndex": 1,
  "thumbnailUrl": "https://img.youtube.com/vi/example/0.jpg",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "subject": Subject
}</pre>
            </div>

            <div class="schema-box">
                <div class="schema-title">📰 News Schema</div>
                <pre>{
  "id": 1,
  "title": "Pengumuman Pendaftaran Kuliah",
  "content": "Konten lengkap berita...",
  "excerpt": "Ringkasan berita...",
  "imageUrl": "https://example.com/news-image.jpg",
  "authorId": 1,
  "category": "GENERAL" | "ACADEMIC" | "EVENTS" | "ANNOUNCEMENTS",
  "tags": "kuliah,pendaftaran,mahasiswa",
  "isPublished": true,
  "isFeatured": false,
  "views": 150,
  "publishedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "author": User
}</pre>
            </div>

            <div class="schema-box">
                <div class="schema-title">📢 Announcement Schema</div>
                <pre>{
  "id": 1,
  "title": "Libur Semester Genap",
  "content": "Pengumuman libur semester...",
  "type": "INFO" | "WARNING" | "URGENT" | "MAINTENANCE",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "authorId": 1,
  "targetAudience": "ALL" | "STUDENT" | "SPECIFIC_SEMESTER",
  "semester": null,
  "isActive": true,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}</pre>
            </div>

            <div class="schema-box">
                <div class="schema-title">📄 Standard Response Format</div>
                <pre>{
  "success": true,
  "message": "Operation successful",
  "data": { /* Response data */ },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
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
            const resultId = 'result-' + endpoint.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            let resultDiv = document.getElementById(resultId);
            
            if (!resultDiv) {
                // Create result div if it doesn't exist
                const endpointDiv = event.target.closest('.endpoint');
                resultDiv = document.createElement('div');
                resultDiv.className = 'result';
                resultDiv.id = resultId;
                endpointDiv.appendChild(resultDiv);
            }
            
            try {
                const options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                };
                
                if (body && method !== 'GET') {
                    options.body = JSON.stringify(body);
                }
                
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<pre>⏳ Loading...</pre>';
                
                const response = await fetch(endpoint, options);
                const data = await response.json();
                
                const statusColor = response.ok ? '#28a745' : '#dc3545';
                resultDiv.innerHTML = \`
                    <div style="margin-bottom: 10px;">
                        <strong style="color: \${statusColor};">Status:</strong> \${response.status} \${response.statusText}
                    </div>
                    <strong>Response:</strong>
                    <pre>\${JSON.stringify(data, null, 2)}</pre>
                \`;
                
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = \`
                    <div style="margin-bottom: 10px;">
                        <strong style="color: #dc3545;">❌ Error:</strong>
                    </div>
                    <pre>\${error.message}</pre>
                \`;
            }
        }
        
        // Auto-test health endpoint on load
        window.onload = function() {
            setTimeout(() => {
                testEndpoint('GET', '/health', null);
            }, 500);
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