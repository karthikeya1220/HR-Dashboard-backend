# API Testing Guide - CORRECTED

## Overview
This guide provides step-by-step instructions for testing the Dashboard Backend API with proper authentication using JWT tokens.

## ⚠️ IMPORTANT: Server Port
The server runs on **PORT 3004**, not 3000. Make sure to use the correct port in all requests.

## Admin User Credentials

### Test Admin User
- **Email**: `admin@example.com`
- **Role**: `ADMIN`
- **Name**: `Admin User`
- **User ID**: `cf9fe180-c529-4759-9098-58a8aba738a4`

### JWT Token for Testing
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8
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
The server will start on `http://localhost:3004`.

### 2. Access Swagger UI
Open your browser and navigate to:
```
http://localhost:3004/api-docs
```

### 3. Authenticate in Swagger UI

1. **Click the "Authorize" button** at the top right of the Swagger UI interface
2. **Enter the Bearer token** in the format:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8
   ```
3. **Click "Authorize"** to save the token
4. **Click "Close"** to return to the API documentation

### 4. Verify Authentication
You should now see **lock icons** next to protected endpoints, indicating they require authentication.

## ✅ VALIDATED API ENDPOINTS

All the following endpoints have been tested and are working correctly:

### Health Check (Public)
```bash
curl -X GET "http://localhost:3004/health"
```
**Response**: `{"status":"OK","timestamp":"2025-08-03T13:05:42.260Z","uptime":94.055056625,"environment":"development","version":"1.0.0"}`

### Authentication Endpoints

#### Get Current User (Protected)
```bash
curl -X GET "http://localhost:3004/api/v1/auth/me" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"
```
**Response**: Returns admin user details

### User Management Endpoints (All Protected)

#### Get All Users
```bash
curl -X GET "http://localhost:3004/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"
```

#### Filter Users by Role
**Valid roles**: `EMPLOYEE`, `MANAGER`, `ADMIN`

```bash
# Get ADMIN users
curl -X GET "http://localhost:3004/api/v1/users?role=ADMIN" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"

# Get EMPLOYEE users
curl -X GET "http://localhost:3004/api/v1/users?role=EMPLOYEE" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"
```

#### Create New User
```bash
curl -X POST "http://localhost:3004/api/v1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8" \
  -d '{"name": "Test Employee", "email": "employee@example.com", "role": "EMPLOYEE"}'
```

## ✅ WORKING EXAMPLES

### Example 1: Get All Users
**Request**:
```bash
curl -X GET "http://localhost:3004/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"
```

**Response**:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "de4038b2-6feb-4dbf-98b5-ec6821a76496",
        "email": "employee@example.com",
        "name": "Test Employee",
        "role": "EMPLOYEE",
        "createdAt": "2025-08-03T13:13:08.942Z",
        "updatedAt": "2025-08-03T13:13:08.942Z"
      },
      {
        "id": "cf9fe180-c529-4759-9098-58a8aba738a4",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "ADMIN",
        "createdAt": "2025-08-03T12:15:55.388Z",
        "updatedAt": "2025-08-03T12:15:55.388Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "timestamp": "2025-08-03T13:13:34.313Z"
}
```

### Example 2: Filter by Role
**Request**:
```bash
curl -X GET "http://localhost:3004/api/v1/users?role=ADMIN" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNmOWZlMTgwLWM1MjktNDc1OS05MDk4LTU4YThhYmE3MzhhNCIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTc1NDIyNjA5NywiZXhwIjoxNzU0MzEyNDk3fQ.ZBQBDTxv-JWq3wCGIzNEJ0IeOtZ3I7nMf0Ri4vuK6l8"
```

**Response**:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "cf9fe180-c529-4759-9098-58a8aba738a4",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "ADMIN",
        "createdAt": "2025-08-03T12:15:55.388Z",
        "updatedAt": "2025-08-03T12:15:55.388Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "timestamp": "2025-08-03T13:12:38.219Z"
}
```

## 🔧 Troubleshooting

### "Failed to fetch" Error in Swagger UI
**Cause**: Using wrong port (3000 instead of 3004)
**Solution**: 
1. Make sure server is running on port 3004
2. Access Swagger UI at `http://localhost:3004/api-docs`
3. Ensure all API calls use port 3004

### "Invalid enum value" Error
**Cause**: Using wrong role values (e.g., 'USER' instead of 'EMPLOYEE')
**Solution**: Use correct role values:
- ✅ `EMPLOYEE`
- ✅ `MANAGER` 
- ✅ `ADMIN`
- ❌ `USER` (not valid)

### Token Expired
If you receive a 401 error with "Invalid or expired token":
1. Generate a new token: `node create-test-token.js`
2. Update the authorization in Swagger UI

## 🎯 Key Points

1. **Server runs on PORT 3004** - not 3000
2. **Role values are**: `EMPLOYEE`, `MANAGER`, `ADMIN` - not `USER`
3. **All user endpoints require authentication**
4. **JWT tokens expire after 24 hours**
5. **Swagger UI has working "Authorize" button**
6. **All protected endpoints show lock icons**

## ✅ Status: FULLY FUNCTIONAL

The API is working perfectly with:
- ✅ Correct port configuration (3004)
- ✅ Working JWT authentication
- ✅ Functional Swagger UI with authorization
- ✅ All endpoints tested and validated
- ✅ Proper role-based filtering
- ✅ Consistent API response format