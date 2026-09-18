import { createClient } from "@/lib/supabase/client";
import { STORAGE_BUCKETS } from "@/lib/constants";

type BucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const PRIVATE_BUCKETS = new Set<string>([
  STORAGE_BUCKETS.PAYMENT_RECEIPTS,
]);

/**
 * Upload a file to a Supabase Storage bucket.
 * For public buckets, returns the public URL.
 * For private buckets (e.g. payment-receipts), returns a temporary signed URL (or data.path).
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

  // Handle private buckets securely via signed URLs
  if (PRIVATE_BUCKETS.has(bucket)) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(data.path, 60 * 60 * 24); // 24-hour signed link

    if (signedError || !signedData?.signedUrl) {
      // Fallback to storing relative storage path for subsequent signed URL retrieval
      return data.path;
    }
    return signedData.signedUrl;
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
 * Get a secure signed URL for a file in a private Supabase Storage bucket.
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Get the public URL for a file in a public Supabase Storage bucket.
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
