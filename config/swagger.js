const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

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

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'HMIF Backend API',
            version: '1.0.0',
            description: 'Complete API documentation for HMIF App Backend',
            contact: {
                name: 'HMIF Development Team',
                email: '11231072@student.itk.ac.id'
            }
        },
        servers: [
            {
                url: baseUrl,
                description: isDevelopment ? 'Development server' : 'Production server'
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
                    name: 'accessToken'
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
                        profilePicture: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' },
                        nim: { type: 'string', example: '11231072' },
                        role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
                        isAdmin: { type: 'boolean', example: false },
                        isActive: { type: 'boolean', example: true },
                        lastLoginAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Authentication successful' },
                        data: {
                            type: 'object',
                            properties: {
                                user: { $ref: '#/components/schemas/User' },
                                token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }
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
    apis: ['./routes/*.js', './app.js']
};

let swaggerSpec = null;
try {
    console.log('📝 Generating Swagger spec...');
    swaggerSpec = swaggerJsdoc(swaggerOptions);
    
    if (!swaggerSpec || !swaggerSpec.openapi) {
        throw new Error('Generated swagger spec is invalid');
    }
    
    console.log('✅ Swagger spec generated successfully');
    console.log(`   Title: ${swaggerSpec.info?.title}`);
    console.log(`   Version: ${swaggerSpec.info?.version}`);
    console.log(`   Servers: ${swaggerSpec.servers?.length || 0}`);
} catch (error) {
    console.error('❌ Failed to generate Swagger spec:', error.message);
    console.error('   Stack:', error.stack);
    swaggerSpec = null;
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

module.exports = exports;