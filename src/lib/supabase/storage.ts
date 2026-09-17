import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/constants";

type BucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * Upload a file to a Supabase Storage bucket.
 * Returns the public URL on success.
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete a file from a Supabase Storage bucket.
 */
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Get the public URL for a file in a Supabase Storage bucket.
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const supabase = createClient();

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Generate a unique file path for uploads.
 * Format: userId/timestamp-filename
 */
export function generateFilePath(
  userId: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${userId}/${timestamp}-${sanitized}`;
}
