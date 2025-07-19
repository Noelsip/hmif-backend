const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const NetworkUtils = require('../utils/network');

const networkInfo = NetworkUtils.getNetworkInfo();
const PORT = process.env.PORT || 3000;

console.log(`📋 Swagger auto-detected network: ${networkInfo.interface} (${networkInfo.ip})`);


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
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
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
                        id: { type: 'integer' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                        profilePicture: { type: 'string' },
                        isAdmin: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Subject: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        code: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        semester: { type: 'integer' },
                        credits: { type: 'integer' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                News: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        content: { type: 'string' },
                        excerpt: { type: 'string' },
                        imageUrl: { type: 'string' },
                        category: { type: 'string' },
                        isPublished: { type: 'boolean' },
                        publishedAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        author: { $ref: '#/components/schemas/User' }
                    }
                },
                LearningVideo: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        videoUrl: { type: 'string' },
                        duration: { type: 'integer' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' },
                        subject: { $ref: '#/components/schemas/Subject' }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object' }
                    }
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'array' },
                        pagination: {
                            type: 'object',
                            properties: {
                                currentPage: { type: 'integer' },
                                totalPages: { type: 'integer' },
                                totalItems: { type: 'integer' },
                                itemsPerPage: { type: 'integer' }
                            }
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ['./routes/*.js', './app.js'],
};

const swaggerSpec = swaggerJsdoc(options);

// Custom Swagger UI options
const swaggerUiOptions = {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'HMIF API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
    }
};

module.exports = {
    swaggerSpec,
    swaggerUi,
    swaggerUiOptions
};