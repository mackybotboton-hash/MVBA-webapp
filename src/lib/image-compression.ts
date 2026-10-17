/**
 * Client-Side Image Compression Utility
 * 
 * Compresses camera and smartphone photos in the browser before upload:
 * - Constrains dimensions to full HD (1600px - 1920px)
 * - Uses high-fidelity bicubic smoothing (visually lossless at 85% quality)
 * - Reduces 3MB-8MB camera files down to ~150KB-300KB
 * - Preserves crystal-clear text on GCash reference numbers and receipts
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  targetFormat?: "image/jpeg" | "image/webp" | "image/png";
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  // If not running in browser or not an image, pass through untouched
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }

  // Vector SVG and animated GIF should not be canvas-rasterized
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  // If file is already lightweight (under 250 KB), skip compression to save CPU
  if (file.size <= 250 * 1024) {
    return file;
  }

  const { maxDimension = 1920, quality = 0.85 } = options;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Constrain dimensions while preserving original aspect ratio
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // Graceful fallback
        return;
      }

      // High-quality bicubic smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Prefer JPEG for universal browser compatibility and predictable size reduction
      const outputType = options.targetFormat || "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compression didn't yield savings, keep the original file
            resolve(file);
            return;
          }

          const originalName = file.name;
          const extension = outputType === "image/webp" ? ".webp" : ".jpg";
          const newName = originalName.replace(/\.[^/.]+$/, "") + extension;

          const compressedFile = new File([blob], newName, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // Fail-safe: never block user from uploading
    };

    img.src = objectUrl;
  });
}
