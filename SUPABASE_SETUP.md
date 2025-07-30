# Supabase Setup Guide

This guide will help you set up Supabase authentication for your Dashboard Backend.

## 🚀 Quick Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up/Login with GitHub
4. Click "New Project"
5. Choose your organization
6. Fill in project details:
   - **Name**: `dashboard-backend`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
7. Click "Create new project"

### Step 2: Get API Keys

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### Step 3: Update Environment Variables

Update your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Step 4: Configure Authentication

1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Configure **Site URL**: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`

### Step 5: Test Authentication

Restart your server and test:

```bash
npm run dev
```

Test registration:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

## 🔧 Advanced Configuration

### Email Templates

1. Go to **Authentication** → **Email Templates**
2. Customize:
   - **Confirm signup**
   - **Reset password**
   - **Magic link**

### Email Settings

1. Go to **Authentication** → **Settings** → **SMTP Settings**
2. Configure your email provider (optional, uses Supabase by default)

### Security Settings

1. **Password Requirements**:
   - Minimum length: 6 characters
   - Require special characters (optional)

2. **Rate Limiting**:
   - Already configured in the backend
   - Additional limits can be set in Supabase

### Social Authentication (Optional)

1. Go to **Authentication** → **Providers**
2. Enable providers like:
   - Google
   - GitHub
   - Discord
   - etc.

## 🧪 Testing the Setup

### 1. Registration Flow

```bash
# Register a new user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@yourdomain.com",
    "password": "securepassword123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for verification.",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "test@yourdomain.com",
      "name": "Test User",
      "role": "USER",
      "emailConfirmed": false
    }
  }
}
```

### 2. Login Flow

```bash
# Login with the user
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@yourdomain.com",
    "password": "securepassword123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "test@yourdomain.com",
      "name": "Test User",
      "role": "USER",
      "emailConfirmed": true
    },
    "session": {
      "access_token": "jwt-token-here",
      "refresh_token": "refresh-token-here",
      "expires_in": 3600
    }
  }
}
```

### 3. Authenticated Requests

```bash
# Get current user (use the access_token from login)
curl -H "Authorization: Bearer your-jwt-token-here" \
  http://localhost:3000/api/v1/auth/me
```

## 🔍 Troubleshooting

### Common Issues

1. **"Authentication service is not configured"**
   - Check your environment variables
   - Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set correctly

2. **"Invalid login credentials"**
   - Check email/password combination
   - Ensure user has verified their email

3. **"Email not confirmed"**
   - Check the user's email for verification link
   - Resend verification if needed

4. **CORS errors**
   - Add your frontend URL to Supabase redirect URLs
   - Check CORS_ORIGIN in your .env file

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

### Database Sync Issues

If users aren't syncing to your local database:
1. Check DATABASE_URL is correct
2. Run `npm run db:push` to ensure schema is up to date
3. Check server logs for database errors

## 🚀 Production Setup

### Environment Variables

For production, set:
```env
NODE_ENV=production
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key
FRONTEND_URL=https://yourdomain.com
```

### Security Checklist

- [ ] Use strong, unique passwords
- [ ] Keep service role key secret
- [ ] Configure proper CORS origins
- [ ] Enable RLS (Row Level Security) in Supabase
- [ ] Set up proper redirect URLs
- [ ] Configure rate limiting
- [ ] Enable email verification

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [JWT Token Verification](https://supabase.com/docs/guides/auth/server-side-rendering)

---

**Need Help?** Check the server logs or create an issue in the repository.