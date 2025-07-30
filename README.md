# Dashboard Backend

A modular monolithic Express.js backend with TypeScript, Prisma, and Supabase authentication.

## 🏗️ Architecture Overview

### Why This Structure Looks Like NestJS?

This project follows a **modular monolithic architecture** that's similar to NestJS but built with Express.js. Here's why:

1. **Modular Organization**: Each feature (auth, users, etc.) is organized in its own module with:
   - `controller.ts` - Handles HTTP requests/responses
   - `service.ts` - Contains business logic
   - `route.ts` - Defines API routes
   - `schema.ts` - Validation schemas

2. **Separation of Concerns**: Clear separation between:
   - Controllers (HTTP layer)
   - Services (Business logic)
   - Database layer (Prisma)
   - Middleware (Authentication, validation, etc.)

3. **Scalability**: Easy to add new modules and features without affecting existing code

### Why Are There 2 Servers?

Actually, there's only **ONE** server running. The confusion might come from:

1. **Development vs Production**: 
   - `npm run dev` - Development server with hot reload
   - `npm run start` - Production server

2. **Docker Configuration**:
   - `docker-compose.yml` - Production environment
   - `docker-compose.dev.yml` - Development environment with just database services

3. **Server Structure**:
   - `src/server.ts` - Main server entry point
   - `src/app.ts` - Express app configuration

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (or use the provided Docker setup)
- Supabase account (for authentication)

### Installation

1. **Clone and install dependencies**:
```bash
npm install
```

2. **Environment Setup**:
Copy `.env.example` to `.env` and configure:

```env
# Environment
NODE_ENV=development
PORT=3000

# Database - Already configured with Neon DB
DATABASE_URL="your-database-url"

# CORS
CORS_ORIGIN=http://localhost:3000

# Supabase Configuration (Required for auth)
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```

3. **Database Setup**:
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

4. **Start Development Server**:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 🔐 Supabase Authentication Setup

### Why Supabase Instead of Custom Auth?

1. **Security**: Production-ready authentication with proper security measures
2. **Features**: Built-in email verification, password reset, social logins
3. **Scalability**: Handles authentication at scale
4. **Maintenance**: No need to maintain custom auth logic

### Setting Up Supabase

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Get your project URL and API keys

2. **Configure Environment Variables**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Authentication Flow**:
   - Users register/login through Supabase
   - JWT tokens are verified on each request
   - User data is synced with local database

### Graceful Degradation

If Supabase is not configured, the server will:
- Start successfully with warnings
- Return 503 errors for auth endpoints
- Continue serving other APIs normally

## 📚 API Documentation

### Available Endpoints

#### Health Check
- `GET /health` - Server health status
- `GET /` - Redirects to API documentation

#### Authentication (Supabase)
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user (requires auth)
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/verify-email` - Verify email address

#### Users
- `GET /api/v1/users` - Get all users (with pagination)
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Interactive Documentation

Visit `http://localhost:3000/api-docs` for Swagger UI documentation.

## 🧪 Testing the APIs

### Using cURL

1. **Health Check**:
```bash
curl http://localhost:3000/health
```

2. **Get Users**:
```bash
curl http://localhost:3000/api/v1/users
```

3. **Register User** (requires Supabase setup):
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Using the API Examples File

Check `api-examples.http` for more example requests.

## 🛠️ Development

### Project Structure

```
src/
├── app.ts                 # Express app configuration
├── server.ts             # Server entry point
├── config/               # Configuration files
│   ├── database.ts       # Prisma configuration
│   ├── supabase.ts       # Supabase client setup
│   └── swagger.ts        # API documentation
├── middlewares/          # Express middlewares
│   ├── errorHandler.ts   # Global error handling
│   ├── supabaseAuth.ts   # Supabase authentication
│   └── validation.ts     # Request validation
├── modules/              # Feature modules
│   ├── auth/            # Authentication module
│   └── users/           # Users module
└── utils/               # Utility functions
    ├── logger.ts        # Winston logger
    └── response.ts      # Response utilities
```

### Adding New Modules

1. Create a new directory in `src/modules/`
2. Add the standard files: `controller.ts`, `service.ts`, `route.ts`, `schema.ts`
3. Register routes in `src/app.ts`

### Database Changes

1. Update `prisma/schema.prisma`
2. Run `npm run db:push` to apply changes
3. Generate new client: `npm run db:generate`

## 🐳 Docker Deployment

### Development with Docker

```bash
# Start database services only
docker-compose -f docker-compose.dev.yml up -d

# Run the app locally
npm run dev
```

### Production Deployment

```bash
# Build and start all services
docker-compose up -d
```

## 🔧 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `SUPABASE_URL` | Supabase project URL | Yes* | - |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes* | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | No | - |
| `CORS_ORIGIN` | Allowed CORS origins | No | `*` |
| `FRONTEND_URL` | Frontend URL for redirects | No | `http://localhost:3000` |

*Required for authentication features

## 🚨 Current Status

✅ **Working Features**:
- Server starts successfully
- Health check endpoint
- User CRUD operations
- Database connection (Neon DB)
- API documentation (Swagger)
- Modular architecture
- Error handling and logging
- Request validation

⚠️ **Requires Setup**:
- Supabase configuration for authentication
- Environment variables for production

🔄 **Ready for**:
- Supabase authentication integration
- Additional modules/features
- Production deployment

## 📝 Next Steps

1. **Configure Supabase**:
   - Set up your Supabase project
   - Add environment variables
   - Test authentication endpoints

2. **Add Features**:
   - Additional modules as needed
   - Business logic implementation
   - Frontend integration

3. **Production Setup**:
   - Configure production environment
   - Set up CI/CD pipeline
   - Deploy to your preferred platform

## 🤝 Contributing

1. Follow the modular structure
2. Add proper TypeScript types
3. Include API documentation
4. Write tests for new features
5. Update this README for significant changes

---

**Note**: This backend is designed to work seamlessly with modern frontend frameworks and provides a solid foundation for scalable applications.