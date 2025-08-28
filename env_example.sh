# Environment
NODE_ENV=development
PORT=4000

# App URL
APP_URL=https://your-domain.vercel.app/

# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Database (Supabase PostgreSQL)
DATABASE_URL=your-supabase-database-url
DIRECT_URL=your-supabase-direct-url

# Storage (Supabase S3-compatible)
S3_ENDPOINT=https://your-project-id.supabase.co/storage/v1/s3
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
STORAGE_BUCKET=merchant-documents

# Email Configuration (Development - no real emails)
EMAIL_PROVIDER=dev
EMAIL_FROM=Luxbyte LLC <no-reply@luxbyte.com>

# Admin Notifications
ADMIN_NOTIFY_EMAILS=admin@luxbyte.com

# Security Keys (Generate random strings for production)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
CSRF_SECRET=your-super-secret-csrf-key-change-this-in-production-min-32-chars

# CORS Origins (comma-separated)
CORS_ORIGINS=https://your-domain.vercel.app,https://*.vercel.app,http://localhost:5173,http://localhost:4000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10

# Admin Seed Data
ADMIN_EMAIL=admin@luxbyte.com
ADMIN_PASSWORD=ChangeMe123!
ADMIN_ROLE=admin

# Instructions:
# 1. Copy this file to .env
# 2. Replace all placeholder values with your actual configuration
# 3. Never commit the .env file to version control
# 4. For production, use environment variables in your hosting platform