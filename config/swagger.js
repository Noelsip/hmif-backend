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
    : `https://${networkInfo.ip}:${HTTPS_PORT}`;

console.log(`🌐 Swagger server URL: ${baseUrl}`);

// Check if route files exist
const routeFilesExist = fs.existsSync('./routes');
const appFileExists = fs.existsSync('./app.js');
console.log('📁 Files check:');
console.log('   Routes directory:', routeFilesExist);
console.log('   App.js file:', appFileExists);

// Build API paths based on existing files
const apiPaths = [];
if (appFileExists) apiPaths.push('./app.js');
if (routeFilesExist) {
    try {
        const routeFiles = fs.readdirSync('./routes');
        routeFiles.forEach(file => {
            if (file.endsWith('.js')) {
                apiPaths.push(`./routes/${file}`);
            }
        });
    } catch (error) {
        console.warn('⚠️  Could not read routes directory:', error.message);
    }
}

console.log('📝 API paths for swagger:', apiPaths);

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
    apis: [apiPaths],
};

let swaggerSpec = null;

// Try generating spec with multiple fallbacks
console.log('📝 Generating Swagger spec...');

// First try: Full spec with all files
try {
    swaggerSpec = swaggerJsdoc(swaggerOptions);
    if (!swaggerSpec || !swaggerSpec.openapi) {
        throw new Error('Generated swagger spec is invalid');
    }
    console.log('✅ Swagger spec generated successfully (with files)');
} catch (error) {
    console.warn('⚠️  Failed to generate spec with files:', error.message);
    
    // Second try: Minimal spec without file parsing
    try {
        const minimalOptions = {
            ...swaggerOptions,
            apis: [] // No files
        };
        swaggerSpec = swaggerJsdoc(minimalOptions);
        console.log('✅ Swagger spec generated (minimal fallback)');
    } catch (minimalError) {
        console.error('❌ Even minimal spec failed:', minimalError.message);
        
        // Third try: Hardcoded spec
        swaggerSpec = {
            openapi: '3.0.0',
            info: {
                title: 'HMIF Backend API',
                version: '1.0.0',
                description: 'API documentation for HMIF Backend (Fallback)'
            },
            servers: [
                {
                    url: baseUrl,
                    description: 'Server'
                }
            ],
            paths: {
                '/': {
                    get: {
                        summary: 'Root endpoint',
                        responses: {
                            '200': {
                                description: 'Success'
                            }
                        }
                    }
                },
                '/health': {
                    get: {
                        summary: 'Health check',
                        responses: {
                            '200': {
                                description: 'Server is healthy'
                            }
                        }
                    }
                }
            },
            components: swaggerOptions.definition.components
        };
        console.log('✅ Using hardcoded swagger spec (final fallback)');
    }
}

if (swaggerSpec) {
    console.log(`   Title: ${swaggerSpec.info?.title}`);
    console.log(`   Version: ${swaggerSpec.info?.version}`);
    console.log(`   Servers: ${swaggerSpec.servers?.length || 0}`);
    console.log(`   Paths: ${Object.keys(swaggerSpec.paths || {}).length}`);
}

const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'HMIF Backend API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
        displayOperationId: false
    }
};

// Validate exports
const exports = {
    swaggerUi,
    swaggerSpec,
    swaggerUiOptions
};

console.log('📦 Swagger module exports:');
console.log('   - swaggerUi:', !!exports.swaggerUi);
console.log('   - swaggerSpec:', !!exports.swaggerSpec);
console.log('   - swaggerUiOptions:', !!exports.swaggerUiOptions);

module.exports = {
    swaggerUi,
    swaggerSpec,
    swaggerUiOptions
};