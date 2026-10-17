/**
 * Client-Side OCR Scanner for GCash Payment Receipts
 * 
 * Uses dynamic in-browser Tesseract.js engine to automatically read
 * and extract the 10-20 digit GCash Reference Number from uploaded screenshots.
 */

export interface OcrScanResult {
  referenceNumber: string | null;
  rawText?: string;
  confidence?: number;
}

export function extractGcashReferenceFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: Explicit "Ref. No." or "Reference No." label followed by digits and spaces
  const explicitMatch = text.match(/(?:ref(?:erence)?\.?\s*(?:no|num|number)?\.?[:\s-]*)([0-9\s]{10,24})/i);
  if (explicitMatch && explicitMatch[1]) {
    const clean = explicitMatch[1].replace(/\D/g, "");
    if (clean.length >= 10 && clean.length <= 20) {
      return clean;
    }
  }

  // Pattern 2: Standard GCash 13-digit format with spaces (e.g. "1002 8492 8492" or "0021 8492 8492")
  const spacedMatch = text.match(/\b(\d{4})[\s-](\d{4})[\s-](\d{4,5})\b/);
  if (spacedMatch) {
    const clean = `${spacedMatch[1]}${spacedMatch[2]}${spacedMatch[3]}`;
    if (clean.length >= 12 && clean.length <= 14) {
      return clean;
    }
  }

  // Pattern 3: Any consecutive sequence of 12-14 digits (typical GCash reference length)
  const digitSequence = text.match(/\b\d{12,14}\b/);
  if (digitSequence) {
    return digitSequence[0];
  }

  return null;
}

/**
 * Extracts the tourist's submitted GCash Reference Number from a stored receipt_url.
 * receipt_url format: "${receiptPath}|${refNumber}" (optionally appended with "||deposit_payout:${payoutPath}")
 */
export function extractGcashRef(receiptUrl?: string | null): string | null {
  if (!receiptUrl || !receiptUrl.includes("|")) return null;
  const touristPart = receiptUrl.split("||")[0];
  const parts = touristPart.split("|");
  if (parts.length > 1 && parts[1]) {
    const ref = parts[1].trim();
    return ref.length >= 8 ? ref : null;
  }
  return null;
}

let tesseractLoadingPromise: Promise<any> | null = null;

async function getTesseract(): Promise<any> {
  if (typeof window === "undefined") return null;
  if ((window as any).Tesseract) return (window as any).Tesseract;

  if (!tesseractLoadingPromise) {
    tesseractLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve((window as any).Tesseract);
      script.onerror = () => {
        tesseractLoadingPromise = null;
        reject(new Error("Failed to load OCR library."));
      };
      document.head.appendChild(script);
    });
  }

  return tesseractLoadingPromise;
}

export async function scanGcashReceipt(file: File): Promise<OcrScanResult> {
  try {
    const Tesseract = await getTesseract();
    if (!Tesseract) return { referenceNumber: null };

    const result = await Tesseract.recognize(file, "eng", {
      logger: () => {},
    });

    const fullText = result?.data?.text || "";
    const referenceNumber = extractGcashReferenceFromText(fullText);

    return {
      referenceNumber,
      rawText: fullText,
      confidence: result?.data?.confidence,
    };
  } catch (err) {
    console.warn("[OCR] Scan failed or skipped:", err);
    return { referenceNumber: null };
  }
}
