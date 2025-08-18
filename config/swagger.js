const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');

console.log('🔧 Initializing Swagger configuration...');

// Safe network info loading with fallback
let networkInfo = { ip: '127.0.0.1' };
try {
    const NetworkUtils = require('../utils/network');
    networkInfo = NetworkUtils.getNetworkInfo();
    console.log('✅ Network utils loaded:', networkInfo.ip);
} catch (error) {
    console.warn('⚠️  NetworkUtils not available, using localhost');
    console.warn('   Error:', error.message);
}

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Use environment-based server URLs
const isDevelopment = process.env.NODE_ENV !== 'production';
const baseUrl = isDevelopment 
    ? `http://localhost:${PORT}`
    : `https://${process.env.DUCKDNS_DOMAIN || networkInfo.ip}:${HTTPS_PORT}`;

console.log(`🌐 Swagger server URL: ${baseUrl}`);

// Build API paths with better error handling
const buildApiPaths = () => {
    const apiPaths = [];
    
    try {
        // Check app.js
        if (fs.existsSync('./app.js')) {
            apiPaths.push('./app.js');
            console.log('✅ app.js found');
        }
        
        // Check routes directory
        if (fs.existsSync('./routes') && fs.statSync('./routes').isDirectory()) {
            const routeFiles = fs.readdirSync('./routes').filter(file => file.endsWith('.js'));
            routeFiles.forEach(file => {
                const fullPath = `./routes/${file}`;
                apiPaths.push(fullPath);
                console.log(`✅ Route file found: ${file}`);
            });
        } else {
            console.warn('⚠️  Routes directory not found');
        }
        
        console.log('📝 Total API paths:', apiPaths.length);
        return apiPaths;
    } catch (error) {
        console.error('❌ Error building API paths:', error.message);
        return [];
    }
};

const apiPaths = buildApiPaths();

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HMIF Backend API',
            version: '1.0.0',
            description: 'Complete API documentation for HMIF App Backend - Academic Learning Management System',
            contact: {
                name: 'HMIF Development Team',
                email: '11231072@student.itk.ac.id'
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
    apis: apiPaths
};

let swaggerSpec = null;

// Enhanced multi-level fallback system
console.log('📝 Generating Swagger spec with enhanced fallbacks...');

// Level 1: Try with all files
try {
    console.log('🧪 Level 1: Full spec with file parsing...');
    swaggerSpec = swaggerJsdoc(options);
    
    if (swaggerSpec && swaggerSpec.openapi && Object.keys(swaggerSpec.paths || {}).length > 0) {
        console.log('✅ Level 1 SUCCESS: Full spec generated with API paths');
    } else {
        throw new Error('Generated spec is empty or invalid');
    }
} catch (error) {
    console.warn('⚠️  Level 1 FAILED:', error.message);
    
    // Level 2: Try without file parsing
    try {
        console.log('🧪 Level 2: Basic spec without file parsing...');
        const basicOptions = {
            ...options,
            apis: []
        };
        swaggerSpec = swaggerJsdoc(basicOptions);
        
        if (swaggerSpec && swaggerSpec.openapi) {
            console.log('✅ Level 2 SUCCESS: Basic spec generated');
        } else {
            throw new Error('Basic spec generation failed');
        }
    } catch (basicError) {
        console.warn('⚠️  Level 2 FAILED:', basicError.message);
        
        // Level 3: Hardcoded fallback spec
        console.log('🧪 Level 3: Hardcoded fallback spec...');
        swaggerSpec = {
            openapi: '3.0.0',
            info: {
                title: 'HMIF Backend API',
                version: '1.0.0',
                description: 'API documentation for HMIF Backend (Emergency Fallback)',
                contact: {
                    name: 'HMIF Development Team',
                    email: '11231072@student.itk.ac.id'
                }
            },
            servers: [
                {
                    url: baseUrl,
                    description: 'Production server'
                }
            ],
            paths: {
                '/': {
                    get: {
                        summary: 'Root endpoint',
                        description: 'Returns API information',
                        responses: {
                            '200': {
                                description: 'Success',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                success: { type: 'boolean' },
                                                message: { type: 'string' },
                                                data: { type: 'object' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                '/health': {
                    get: {
                        summary: 'Health check endpoint',
                        description: 'Returns server health status',
                        responses: {
                            '200': {
                                description: 'Server is healthy',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                success: { type: 'boolean' },
                                                message: { type: 'string' },
                                                data: { type: 'object' }
                                            }
                                        }
                                    }
                                }
                            },
                            '503': {
                                description: 'Service unavailable'
                            }
                        }
                    }
                },
                '/auth/google': {
                    get: {
                        tags: ['Authentication'],
                        summary: 'Google OAuth login',
                        description: 'Initiates Google OAuth authentication flow',
                        responses: {
                            '302': {
                                description: 'Redirect to Google OAuth'
                            },
                            '500': {
                                description: 'OAuth configuration error',
                                content: {
                                    'application/json': {
                                        schema: { $ref: '#/components/schemas/ErrorResponse' }
                                    }
                                }
                            }
                        }
                    }
                },
                '/auth/success': {
                    get: {
                        tags: ['Authentication'],
                        summary: 'OAuth success endpoint',
                        description: 'Returns user information after successful OAuth',
                        parameters: [
                            {
                                in: 'query',
                                name: 'token',
                                required: true,
                                schema: { type: 'string' },
                                description: 'JWT token from OAuth callback'
                            }
                        ],
                        responses: {
                            '200': {
                                description: 'Authentication successful',
                                content: {
                                    'application/json': {
                                        schema: { $ref: '#/components/schemas/AuthResponse' }
                                    }
                                }
                            },
                            '400': {
                                description: 'No token provided'
                            },
                            '401': {
                                description: 'Invalid token'
                            }
                        }
                    }
                },
                '/auth/me': {
                    get: {
                        tags: ['Authentication'],
                        summary: 'Get current user',
                        description: 'Returns current authenticated user information',
                        security: [
                            { bearerAuth: [] },
                            { cookieAuth: [] }
                        ],
                        responses: {
                            '200': {
                                description: 'User information retrieved',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                success: { type: 'boolean' },
                                                data: { $ref: '#/components/schemas/User' }
                                            }
                                        }
                                    }
                                }
                            },
                            '401': {
                                description: 'Unauthorized'
                            }
                        }
                    }
                },
                '/auth/logout': {
                    post: {
                        tags: ['Authentication'],
                        summary: 'Logout user',
                        description: 'Clears authentication cookies',
                        responses: {
                            '200': {
                                description: 'Successfully logged out'
                            }
                        }
                    }
                }
            },
            components: options.definition.components
        };
        console.log('✅ Level 3 SUCCESS: Hardcoded spec created');
    }
}

// Final validation
if (!swaggerSpec) {
    console.error('❌ All fallback levels failed - creating emergency minimal spec');
    swaggerSpec = {
        openapi: '3.0.0',
        info: {
            title: 'HMIF Backend API',
            version: '1.0.0',
            description: 'Emergency minimal API documentation'
        },
        servers: [{ url: baseUrl }],
        paths: {
            '/': {
                get: {
                    summary: 'Root endpoint',
                    responses: { '200': { description: 'Success' } }
                }
            }
        }
    };
}

// Log final spec info
console.log('📊 Final Swagger spec info:');
console.log(`   Title: ${swaggerSpec.info?.title}`);
console.log(`   Version: ${swaggerSpec.info?.version}`);
console.log(`   Servers: ${swaggerSpec.servers?.length || 0}`);
console.log(`   Paths: ${Object.keys(swaggerSpec.paths || {}).length}`);

const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'HMIF Backend API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
        displayOperationId: false,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2
    }
};

console.log('📦 Swagger module exports:');
console.log('   - swaggerUi:', !!swaggerUi);
console.log('   - swaggerSpec:', !!swaggerSpec);
console.log('   - swaggerUiOptions:', !!swaggerUiOptions);

module.exports = {
    swaggerUi,
    swaggerSpec,
    swaggerUiOptions
};