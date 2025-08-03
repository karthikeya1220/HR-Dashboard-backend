# Employee Management System

## Overview

This comprehensive employee management system provides a complete solution for managing employee data with role-based access control, Supabase authentication integration, and a robust API structure.

## Features

### 🔐 Authentication & Authorization
- **Supabase Integration**: Full integration with Supabase Auth for user management
- **Role-Based Access Control**: Three-tier hierarchy (Admin > Manager > Employee)
- **JWT Token Validation**: Secure token-based authentication
- **Admin-Only User Creation**: Only admins can create employee accounts

### 👥 Employee Management
- **Two-Step Employee Creation**: Separate Supabase user creation and profile creation
- **Comprehensive Profile Data**: Personal, employment, and additional information
- **Advanced Search & Filtering**: Search by name, email, department, employment type
- **Pagination Support**: Efficient data retrieval with pagination
- **Employee Statistics**: Dashboard-ready statistics and analytics

### 🛡️ Security Features
- **Input Validation**: Comprehensive Zod schema validation
- **Rate Limiting**: Protection against abuse
- **Error Handling**: Structured error responses with proper HTTP status codes
- **Audit Logging**: Track who created/modified employee records
- **Data Consistency**: Atomic operations across Supabase and local database

## API Endpoints

### 1. Create Supabase User Account
```http
POST /api/v1/add-emp
```
**Purpose**: Creates employee user in Supabase Auth using Admin API (Step 1)

**Required Role**: Admin

**Request Body**:
```json
{
  "email": "john.doe@company.com",
  "password": "TempPass123!",
  "name": "John Doe",
  "role": "EMPLOYEE"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Supabase user account created successfully",
  "data": {
    "authUserId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@company.com",
    "role": "EMPLOYEE",
    "name": "John Doe"
  }
}
```

### 2. Create Complete Employee Profile
```http
POST /api/v1/employees
```
**Purpose**: Creates full employee profile in local database (Step 2)

**Required Role**: Admin

**Request Body**: [See detailed schema below](#employee-data-structure)

### 3. Get Employee by ID
```http
GET /api/v1/employees/:id
```
**Purpose**: Retrieve detailed employee profile

**Required Role**: Any authenticated user

### 4. Get All Employees
```http
GET /api/v1/employees?page=1&limit=10&search=john&department=ENGINEERING
```
**Purpose**: List employees with pagination and filtering

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term for name, email, or job title
- `department`: Filter by department
- `employmentType`: Filter by employment type
- `isActive`: Filter by active status

### 5. Update Employee Profile
```http
PATCH /api/v1/employees/:id
```
**Purpose**: Update employee information

**Required Role**: Admin

### 6. Delete Employee
```http
DELETE /api/v1/employees/:id
```
**Purpose**: Delete employee from both local database and Supabase

**Required Role**: Admin

### 7. Employee Statistics
```http
GET /api/v1/employees/stats
```
**Purpose**: Get employee statistics for dashboard

**Required Role**: Admin

## Employee Data Structure

### Personal Information (Required fields marked with *)
- **firstName*** - First name
- **lastName*** - Last name
- **dateOfBirth*** - Date in dd/mm/yyyy format
- **gender*** - MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY
- **maritalStatus*** - SINGLE | MARRIED | DIVORCED | WIDOWED | SEPARATED
- **contactNumber*** - Phone number
- **email*** - Email address
- middleName - Middle name (optional)
- emergencyContactName - Emergency contact name (optional)
- emergencyContactRelationship - SPOUSE | PARENT | SIBLING | FRIEND | OTHER (optional)
- emergencyContactPhone - Emergency contact phone (optional)
- currentAddress - Current address (optional)
- permanentAddress - Permanent address (optional)

### Employment Information (Required fields marked with *)
- **jobTitle*** - Job title
- **department*** - HR | ENGINEERING | SALES | UI | DEVELOPER | OTHER
- **employmentType*** - FULL_TIME | PART_TIME | INTERN | CONTRACT
- **hireDate*** - Hire date in dd/mm/yyyy format
- **workLocation*** - City name or "Remote"
- departmentOther - Required if department is OTHER
- reportingManager - Reporting manager name (optional)
- salaryGrade - Salary grade (optional)

### Additional Information (All optional)
- educationHistory - Array of education records
- certifications - Array of certifications
- skills - Array of skills (e.g., ["JavaScript", "React", "Node.js"])
- previousWorkExperience - Array of work experience records
- bankAccountNumber - Bank account number
- bankName - Bank name
- bankBranch - Bank branch
- routingNumber - IFSC code or routing number

## Workflow

### Employee Creation Process
1. **Admin creates Supabase user** via `POST /api/v1/add-emp`
2. **System returns authUserId** from Supabase
3. **Admin creates complete profile** via `POST /api/v1/employees` using the authUserId
4. **System stores profile locally** and links to Supabase user

### Employee Deletion Process
1. **Admin initiates deletion** via `DELETE /api/v1/employees/:id`
2. **System deletes from local database** first
3. **System deletes from Supabase** Auth
4. **Rollback mechanism** ensures data consistency if any step fails

## Role-Based Access Control

### Admin Role
- Create, read, update, delete all employees
- Access employee statistics
- Full system privileges

### Manager Role
- Read employee information
- Additional permissions for Leave Management and Attendance (future modules)

### Employee Role
- Read own profile information
- Access to employee-specific features

## Security Best Practices

### Input Validation
- All inputs validated using Zod schemas
- Date format validation (dd/mm/yyyy)
- Email format validation
- Required field validation
- Custom business logic validation

### Authentication & Authorization
- JWT token validation on every request
- Role-based middleware protection
- Supabase Admin API for user management
- Secure password handling (managed by Supabase)

### Error Handling
- Structured error responses
- Proper HTTP status codes
- Detailed error logging
- No sensitive information in error messages

### Data Consistency
- Atomic operations across systems
- Rollback mechanisms for failed operations
- Audit trails for all changes
- Correlation IDs for request tracking

## Database Schema

### Employee Table
```sql
model Employee {
  id                          String                           @id @default(uuid())
  supabaseId                  String                           @unique
  
  // Personal Information
  firstName                   String
  middleName                  String?
  lastName                    String
  dateOfBirth                 DateTime
  gender                      Gender
  maritalStatus               MaritalStatus
  contactNumber               String
  email                       String                           @unique
  emergencyContactName        String?
  emergencyContactRelationship EmergencyContactRelationship?
  emergencyContactPhone       String?
  currentAddress              String?
  permanentAddress            String?
  
  // Employment Information
  jobTitle                    String
  department                  Department
  departmentOther             String?
  employmentType              EmploymentType
  hireDate                    DateTime
  workLocation                String
  reportingManager            String?
  salaryGrade                 String?
  
  // Additional Information
  educationHistory            Json?
  certifications              Json?
  skills                      String[]
  previousWorkExperience      Json?
  bankAccountNumber           String?
  bankName                    String?
  bankBranch                  String?
  routingNumber               String?
  
  // Metadata
  isActive                    Boolean                          @default(true)
  createdBy                   String?
  createdAt                   DateTime                         @default(now())
  updatedAt                   DateTime                         @updatedAt
  
  @@map("employees")
}
```

## API Documentation

The system includes comprehensive Swagger/OpenAPI documentation available at `/api-docs` when the server is running. The documentation includes:

- Complete API endpoint documentation
- Request/response schemas
- Authentication requirements
- Example requests and responses
- Error response formats

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authorization token required",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Required role: ADMIN",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Employee not found",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "Employee with this email already exists",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Performance Considerations

### Database Optimization
- Indexed fields for fast queries (supabaseId, email, department, employmentType, isActive)
- Pagination to limit data transfer
- Efficient search queries with proper indexing

### Caching Strategy
- JWT token validation caching (future enhancement)
- Employee statistics caching (future enhancement)
- Connection pooling for database operations

### Scalability
- Stateless design for horizontal scaling
- Modular architecture for easy maintenance
- Separation of concerns between authentication and business logic

## Future Enhancements

### Planned Features
- Employee photo upload and management
- Document management system
- Employee onboarding workflow
- Performance review system
- Leave management integration
- Attendance tracking integration
- Notification system
- Bulk employee operations
- Advanced reporting and analytics
- Employee self-service portal

### Technical Improvements
- Redis caching layer
- Webhook system for real-time updates
- Advanced audit logging
- Data export functionality
- API rate limiting per user
- Advanced search with Elasticsearch
- Real-time notifications

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Supabase project with Auth enabled
- Environment variables configured

### Installation
1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations: `npm run db:migrate`
4. Generate Prisma client: `npm run db:generate`
5. Start the server: `npm run dev`

### Environment Variables
```env
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Testing the API
1. Access Swagger documentation at `http://localhost:3000/api-docs`
2. Use the provided API examples
3. Test with tools like Postman or curl

## Support

For questions, issues, or feature requests, please refer to the project documentation or contact the development team.