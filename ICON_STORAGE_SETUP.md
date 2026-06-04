# App Icons Storage Setup

When adding the app icon feature, you need to set up Supabase Storage to handle icon uploads.

## Steps to Enable App Icon Storage

### 1. Create the Storage Bucket in Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **Create a new bucket**
5. Configure the bucket:
   - **Name:** `app-icons`
   - **Public:** Toggle ON (so icons are publicly accessible)
6. Click **Create bucket**

### 2. Run the Storage Policies Migration

Once the bucket is created, run the SQL migration to set up access control:

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Copy and paste the contents of `supabase/migrations/20260601_app_icons_storage.sql`
4. Click **Run**

This will create policies that:
- Allow developers to upload icons to their own folder (`user_id/`)
- Allow anyone to view the icons
- Allow developers to delete their own icons

### 3. Environment Variables

Make sure these environment variables are set (they should already be configured):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## How It Works

1. **User Uploads Icon**: Developer fills out the app form and selects an icon image
2. **Form Submission**: The form sends the icon as FormData to `/api/v1/apps`
3. **File Upload**: The server uploads the icon to Supabase Storage:
   - Path: `app-icons/{user_id}/{timestamp}.{extension}`
   - Example: `app-icons/123e4567-e89b-12d3-a456-426614174000/1717252800000.png`
4. **Database Record**: The public URL is saved in the `apps` table `icon_url` field
5. **Public URL**: The icon is accessible at: `https://your-project.supabase.co/storage/v1/object/public/app-icons/{path}`

## Icon Requirements

- **Formats**: PNG, JPG, GIF, WebP
- **Max Size**: 5MB
- **Recommended**: Square images (1:1 aspect ratio)
- **Recommended Dimensions**: 512x512px or higher

## Troubleshooting

### Icons Not Uploading
- Ensure the `app-icons` bucket exists and is public
- Verify the storage policies SQL migration was run
- Check browser console for specific error messages

### Icons Not Displaying
- Verify the bucket is marked as **Public** in Supabase Storage settings
- Check that the `icon_url` is correctly saved in the database
- Ensure the app record was created successfully

### Permission Denied Errors
- Run the storage policies migration again
- Verify user is authenticated (check auth cookies)
