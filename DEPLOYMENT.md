# Deployment Guide - Forge AI Website Builder

This guide will help you deploy your Forge AI website builder to Vercel with your own Supabase and OpenAI configuration.

## Prerequisites

- Supabase account with a project created
- OpenAI API key
- Google Cloud Console project (for Google OAuth)
- Vercel account
- Node.js installed locally

## Step 1: Supabase Setup

### 1.1 Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings > API**
4. Copy these values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon public** key (this is your `SUPABASE_PUBLISHABLE_KEY`)
   - **service secret** key (this is your `SUPABASE_SERVICE_ROLE_KEY`)

### 1.2 Run Database Migrations

Your Supabase project needs the database schema. Run the migrations in the `supabase/migrations` folder:

1. Go to **SQL Editor** in your Supabase Dashboard
2. Create a new query
3. Copy and run each SQL file from `supabase/migrations/` in order:
   - `20260702091849_0b459502-1a5a-46ab-a70f-f5d2b06f4099.sql`
   - `20260702091907_f9eaf6c0-ac4e-4d57-84b9-872af71fae21.sql`
   - `20260704073201_c582a56c-9251-4ced-9c8e-1c62e2f61f19.sql`

### 1.3 Configure Google OAuth in Supabase

1. Go to **Authentication > Providers** in Supabase Dashboard
2. Enable **Google** provider
3. You'll need Google Client ID and Secret (see Step 2)

## Step 2: Google OAuth Setup

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **Google+ API** (if not already enabled)

### 2.2 Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback` (for local development)
   - `https://your-vercel-domain.vercel.app/auth/callback` (for production)
5. Copy the **Client ID** and **Client Secret**

### 2.3 Configure in Supabase

1. Go back to Supabase Dashboard > Authentication > Providers > Google
2. Paste your Google Client ID and Client Secret
3. Save the configuration

## Step 3: OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Copy the API key (starts with `sk-`)

## Step 4: Local Development Setup

1. Copy `.env.example` to `.env`
2. Fill in your credentials:

```env
SUPABASE_PROJECT_ID="your-project-id"
SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-secret-key"
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-public-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
OPENAI_API_KEY="your-openai-api-key"
```

3. Install dependencies:
```bash
npm install
```

4. Run development server:
```bash
npm run dev
```

5. Open `http://localhost:5173` in your browser

## Step 5: Deploy to Vercel

### 5.1 Push Code to GitHub

1. Initialize git repository (if not already):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. Create a repository on GitHub
3. Push your code:
```bash
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

### 5.2 Deploy to Vercel

1. Go to [Vercel](https://vercel.com/)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure environment variables in Vercel:
   - `SUPABASE_PROJECT_ID`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
   - `OPENAI_API_KEY`

5. Click **Deploy**

### 5.3 Update Google OAuth Redirect URI

After deployment:
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Edit your OAuth client ID
3. Add your Vercel domain: `https://your-domain.vercel.app/auth/callback`
4. Save

## Step 6: Update Supabase Site URL

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Update **Site URL** to your Vercel domain
3. Update **Redirect URLs** to include your Vercel domain

## Troubleshooting

### Google OAuth Not Working
- Ensure redirect URIs match exactly (including trailing slashes)
- Check that Google OAuth is enabled in Supabase
- Verify your Google Client ID and Secret are correct

### Supabase Connection Issues
- Verify your Supabase URL and keys are correct
- Check that RLS policies are set up correctly
- Ensure migrations were run successfully

### AI Generation Not Working
- Verify your OpenAI API key is valid
- Check that you have credits in your OpenAI account
- Ensure the API key is set in Vercel environment variables

### Build Errors
- Run `npm install` locally to ensure dependencies are up to date
- Check that Node.js version is compatible (use Node 18+)
- Review build logs in Vercel for specific errors

## Architecture Overview

This is a **single Vercel project** that includes:
- **Frontend**: React app built with TanStack Start
- **Backend**: Serverless functions (API routes in `/api`)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API for code generation

The application handles both client and server code in one deployment, with Vercel automatically routing between static assets and server functions.

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_PROJECT_ID` | Your Supabase project ID | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server) | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Same as SUPABASE_PROJECT_ID | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as SUPABASE_PUBLISHABLE_KEY | Yes |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI generation | Yes |

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs in the dashboard
3. Verify all environment variables are set correctly
4. Ensure all migrations were run in Supabase
