import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Dashboard Backend API',
    version: '1.0.0',
    description:
      'A modular monolithic Express.js backend with TypeScript, Prisma, and comprehensive API documentation',
    contact: {
      name: 'API Support',
      email: 'support@dashboard.com',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.dashboard.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT Bearer token',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email', 'name', 'role', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Unique identifier for the user',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          name: {
            type: 'string',
            minLength: 2,
            description: 'User full name',
            example: 'John Doe',
          },
          role: {
            type: 'string',
            enum: ['USER', 'ADMIN'],
            description: 'User role',
            example: 'USER',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'User creation timestamp',
            example: '2023-01-01T00:00:00.000Z',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'User last update timestamp',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          name: {
            type: 'string',
            minLength: 2,
            description: 'User full name',
            example: 'John Doe',
          },
          role: {
            type: 'string',
            enum: ['USER', 'ADMIN'],
            description: 'User role',
            example: 'USER',
            default: 'USER',
          },
        },
      },
      UpdateUserRequest: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          name: {
            type: 'string',
            minLength: 2,
            description: 'User full name',
            example: 'John Doe',
          },
          role: {
            type: 'string',
            enum: ['USER', 'ADMIN'],
            description: 'User role',
            example: 'USER',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password',
            example: 'password123',
          },
          name: {
            type: 'string',
            minLength: 2,
            description: 'User full name',
            example: 'John Doe',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
            example: 'john.doe@example.com',
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password',
            example: 'password123',
          },
        },
      },
      ApiResponse: {
        type: 'object',
        required: ['success', 'message', 'timestamp'],
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the request was successful',
            example: true,
          },
          message: {
            type: 'string',
            description: 'Response message',
            example: 'Operation completed successfully',
          },
          data: {
            description: 'Response data (varies by endpoint)',
          },
          error: {
            type: 'string',
            description: 'Error message (only present when success is false)',
            example: 'Validation failed',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Response timestamp',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
      },
      PaginatedUsersResponse: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/User',
            },
          },
          total: {
            type: 'integer',
            description: 'Total number of users',
            example: 100,
          },
          page: {
            type: 'integer',
            description: 'Current page number',
            example: 1,
          },
          limit: {
            type: 'integer',
            description: 'Number of items per page',
            example: 10,
          },
          totalPages: {
            type: 'integer',
            description: 'Total number of pages',
            example: 10,
          },
        },
      },
      UserStats: {
        type: 'object',
        properties: {
          totalUsers: {
            type: 'integer',
            description: 'Total number of users',
            example: 100,
          },
          adminUsers: {
            type: 'integer',
            description: 'Number of admin users',
            example: 5,
          },
          regularUsers: {
            type: 'integer',
            description: 'Number of regular users',
            example: 95,
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'OK',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
          uptime: {
            type: 'number',
            description: 'Server uptime in seconds',
            example: 3600,
          },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Validation failed',
          },
          error: {
            type: 'string',
            example: 'email: Invalid email format, name: Name must be at least 2 characters',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2023-01-01T00:00:00.000Z',
          },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ValidationError',
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { example: false },
                    message: { example: 'Resource not found' },
                  },
                },
              ],
            },
          },
        },
      },
      ServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/ApiResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { example: false },
                    message: { example: 'Internal server error' },
                  },
                },
              ],
            },
          },
        },
      },
    },
    parameters: {
      UserId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'User ID',
        schema: {
          type: 'string',
          format: 'uuid',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: {
          type: 'integer',
          minimum: 1,
          default: 1,
          example: 1,
        },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 10,
          example: 10,
        },
      },
      Search: {
        name: 'search',
        in: 'query',
        description: 'Search term for filtering users by name or email',
        schema: {
          type: 'string',
          example: 'john',
        },
      },
      Role: {
        name: 'role',
        in: 'query',
        description: 'Filter users by role',
        schema: {
          type: 'string',
          enum: ['USER', 'ADMIN'],
          example: 'USER',
        },
      },
    },
  },
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Users',
      description: 'User management endpoints',
    },
    {
      name: 'Authentication',
      description: 'Authentication and authorization endpoints',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/modules/*/route.ts', './src/app.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);
