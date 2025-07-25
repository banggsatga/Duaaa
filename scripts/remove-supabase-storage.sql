-- Remove Supabase storage buckets and policies since we're using Pinata/IPFS
-- This script cleans up any existing Supabase storage configuration

-- Drop storage policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post images" ON storage.objects;

-- Remove storage buckets (optional - you can keep them if needed for other purposes)
-- DELETE FROM storage.buckets WHERE id IN ('avatars', 'posts');

-- Add comment to profiles table to indicate IPFS usage
COMMENT ON COLUMN profiles.avatar_url IS 'IPFS URL from Pinata Cloud storage';

-- Add comment to posts table to indicate IPFS usage  
COMMENT ON COLUMN posts.image_url IS 'IPFS URL from Pinata Cloud storage';
