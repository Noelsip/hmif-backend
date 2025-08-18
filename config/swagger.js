const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Safe network info loading
let networkInfo = { ip: 'localhost' };
try {
    const NetworkUtils = require('../utils/network');
    networkInfo = NetworkUtils.getNetworkInfo();
} catch (error) {
    console.warn('NetworkUtils not available, using localhost');
}

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
                        profilePicture: { type: 'string', format: 'uri', example: 'https://example.com/avatar.jpg' }, // Fixed field name
                        nim: { type: 'string', example: '11231072' },
                        role: { type: 'string', enum: ['USER', 'ADMIN'], example: 'USER' },
                        isAdmin: { type: 'boolean', example: false }, // Added isAdmin field
                        isActive: { type: 'boolean', example: true },
                        lastLoginAt: { type: 'string', format: 'date-time' }, // Fixed field name
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
    apis: ['./routes/*.js', './app.js'],
};

let swaggerSpec;
try {
    swaggerSpec = swaggerJsdoc(options);
    console.log('✅ Swagger spec generated successfully');
} catch (error) {
    console.error('❌ Failed to generate Swagger spec:', error.message);
    swaggerSpec = null;
}

const swaggerUiOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'HMIF Backend API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true
    }
};

module.exports = {
    swaggerUi,
    swaggerSpec,
    swaggerUiOptions
};