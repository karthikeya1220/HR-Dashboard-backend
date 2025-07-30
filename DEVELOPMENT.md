# Development Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Start database (using Docker)**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Set up database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## Database Setup

### Option 1: Using Docker (Recommended)
```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Update .env with Docker database URL
DATABASE_URL="postgresql://dashboard_user:dashboard_password@localhost:5432/dashboard_db?schema=public"
```

### Option 2: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database named `dashboard_db`
3. Update `.env` with your local database credentials

## Available Commands

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server

### Database
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database (development)
- `npm run db:migrate` - Create and run migrations (production)
- `npm run db:studio` - Open Prisma Studio

### Code Quality
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

## Testing the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Create a User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  }'
```

### Get Users
```bash
curl http://localhost:3000/api/v1/users
```

## Project Structure

```
src/
├── modules/           # Feature modules
│   ├── auth/         # Authentication module
│   └── user/         # User management module
├── middlewares/      # Express middlewares
├── utils/           # Utility functions
├── config/          # Configuration files
├── app.ts           # Express app setup
└── server.ts        # Server entry point
```

## Environment Variables

Required environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret key (for future auth implementation)

## Docker Development

### Start only database services
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Full application with Docker
```bash
docker-compose up -d
```

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is running
2. Check DATABASE_URL in .env
3. Verify database exists and credentials are correct

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Prisma Issues
```bash
# Reset Prisma client
rm -rf node_modules/.prisma
npm run db:generate
```