# API Testing Guide

## Overview
This guide provides step-by-step instructions for testing the Dashboard Backend API with proper authentication using JWT tokens.

## Admin User Credentials

### Test Admin User
- **Email**: `admin@example.com`
- **Role**: `ADMIN`
- **Name**: `Admin User`
- **User ID**: `cf9fe180-c529-4759-9098-58a8aba738a4`

### JWT Token for Testing
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNTY3NiwiZXhwIjoxNzU0MzEyMDc2fQ.ewSeP6QW-igh4SYmJ96mWCxp3kXWjOoNrpXS3khebkE
```

**Note**: This token is valid for 24 hours. To generate a new token, run:
```bash
node create-test-token.js
```

## Getting Started

### 1. Start the Server
```bash
npm run dev
```
The server will start on `http://localhost:3000` (or the port specified in your environment).

### 2. Access Swagger UI
Open your browser and navigate to:
```
http://localhost:3000/api-docs
```

### 3. Authenticate in Swagger UI

1. **Click the "Authorize" button** at the top right of the Swagger UI interface
2. **Enter the Bearer token** in the format:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNTY3NiwiZXhwIjoxNzU0MzEyMDc2fQ.ewSeP6QW-igh4SYmJ96mWCxp3kXWjOoNrpXS3khebkE
   ```
3. **Click "Authorize"** to save the token
4. **Click "Close"** to return to the API documentation

### 4. Verify Authentication
You should now see **lock icons** next to protected endpoints, indicating they require authentication.

## Testing Protected Endpoints

### Authentication Endpoints

#### Test Current User Info
1. Navigate to **Authentication** → **GET /api/v1/auth/me**
2. Click **"Try it out"**
3. Click **"Execute"**
4. You should receive a 200 response with the admin user details

### User Management Endpoints

#### Get All Users
1. Navigate to **Users** → **GET /api/v1/users**
2. Click **"Try it out"**
3. Optionally set query parameters (page, limit, search, role)
4. Click **"Execute"**
5. You should receive a paginated list of users

#### Get User Statistics
1. Navigate to **Users** → **GET /api/v1/users/stats**
2. Click **"Try it out"**
3. Click **"Execute"**
4. You should receive user statistics (total, admin, regular users)

#### Create a New User
1. Navigate to **Users** → **POST /api/v1/users**
2. Click **"Try it out"**
3. Use the example payload:
   ```json
   {
     "name": "Test User",
     "email": "test@example.com",
     "role": "USER"
   }
   ```
4. Click **"Execute"**
5. You should receive a 201 response with the created user

#### Get User by ID
1. Navigate to **Users** → **GET /api/v1/users/{id}**
2. Click **"Try it out"**
3. Enter a valid user ID (use the admin ID: `cf9fe180-c529-4759-9098-58a8aba738a4`)
4. Click **"Execute"**
5. You should receive the user details

#### Update User
1. Navigate to **Users** → **PUT /api/v1/users/{id}**
2. Click **"Try it out"**
3. Enter a valid user ID
4. Provide update data:
   ```json
   {
     "name": "Updated Name"
   }
   ```
5. Click **"Execute"**
6. You should receive the updated user data

#### Delete User
1. Navigate to **Users** → **DELETE /api/v1/users/{id}**
2. Click **"Try it out"**
3. Enter a valid user ID (not the admin ID)
4. Click **"Execute"**
5. You should receive a success message

### Employee Management Endpoints

#### Get All Employees
1. Navigate to **GET /api/v1/employees**
2. Click **"Try it out"**
3. Click **"Execute"**
4. You should receive a list of employees

#### Create Employee
1. Navigate to **POST /api/v1/employees**
2. Click **"Try it out"**
3. Use the example payload for creating an employee
4. Click **"Execute"**

## Testing Without Authentication

### Public Endpoints
The following endpoints do not require authentication:
- **GET /health** - Health check
- **POST /api/v1/auth/register** - User registration
- **POST /api/v1/auth/login** - User login
- **POST /api/v1/auth/logout** - User logout

### Testing Unauthorized Access
1. **Remove the authorization token**:
   - Click "Authorize" button
   - Clear the token field
   - Click "Authorize" then "Close"

2. **Try accessing a protected endpoint**:
   - Navigate to any Users endpoint
   - Click "Try it out" and "Execute"
   - You should receive a **401 Unauthorized** response

## API Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ },
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "timestamp": "2023-01-01T00:00:00.000Z"
}
```

## Common HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Authentication required or invalid token
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource already exists
- **500 Internal Server Error** - Server error

## Troubleshooting

### Token Expired
If you receive a 401 error with "Invalid or expired token":
1. Generate a new token: `node create-test-token.js`
2. Update the authorization in Swagger UI

### Server Not Starting
1. Check if the port is already in use
2. Verify environment variables are set correctly
3. Check the logs for specific error messages

### Database Connection Issues
1. Verify database configuration in `.env`
2. Check if the database is running
3. Run database migrations if needed

## Additional Testing Tools

### Using cURL
```bash
# Get current user
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get all users
curl -X GET "http://localhost:3000/api/v1/users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Using Postman
1. Import the API collection (if available)
2. Set up environment variables for the base URL and token
3. Use the Bearer token authentication type

## Security Notes

- JWT tokens are used for authentication in development mode
- Tokens expire after 24 hours for security
- Admin users have full access to all endpoints
- Regular users have limited access (role-based permissions)
- All protected endpoints require valid JWT tokens

## Support

If you encounter any issues:
1. Check the server logs for error details
2. Verify your JWT token is valid and not expired
3. Ensure you're using the correct API endpoints
4. Check the network connectivity to the server