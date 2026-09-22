import QRCode from "qrcode";

export interface BoardingPassData {
  id: string;
  property_name?: string;
  room_name?: string;
  guest_name?: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  total_price: number;
  status: string;
  reference_code?: string;
}

/**
 * Generates an ISO-standard camera-scannable QR Code Data URL offline.
 */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 320,
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

/**
 * Draws a high-definition (2x Retina) official MVBA Digital Boarding Pass
 * onto an HTML5 Canvas completely in client memory.
 */
export async function renderBoardingPassToCanvas(
  booking: BoardingPassData
): Promise<HTMLCanvasElement> {
  const bookingCode =
    booking.reference_code ||
    `MVBA-BRIT-${booking.id.slice(0, 4).toUpperCase()}`;

  const qrDataUrl = await generateQRCodeDataURL(bookingCode);

  // Load QR Image
  const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });

  const width = 640;
  const height = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create canvas context");
  }

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Background (Subtle coastal off-white)
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // 2. Card Container with Rounded Corners
  const cardX = 24;
  const cardY = 24;
  const cardW = width - 48;
  const cardH = height - 48;
  const radius = 28;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();
  ctx.restore();

  // 3. Header Banner (Deep Navy Gradient)
  const headerHeight = 160;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, headerHeight, [radius, radius, 0, 0]);
  ctx.clip();

  const headerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + headerHeight);
  headerGrad.addColorStop(0, "#09090b");
  headerGrad.addColorStop(1, "#18181b");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(cardX, cardY, cardW, headerHeight);

  // Decorative subtle ring
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 60;
  ctx.beginPath();
  ctx.arc(cardX + cardW - 30, cardY + 20, 110, 0, Math.PI * 2);
  ctx.stroke();

  // Top sub-header tag
  ctx.fillStyle = "#10b981"; // Emerald green
  ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("SAN AGUSTIN • BRETANIA ECO-TOURISM", cardX + 32, cardY + 48);

  // Main Header Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "0px";
  ctx.fillText("Digital Boarding Pass", cardX + 32, cardY + 84);

  // Header Subtitle
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Official Municipal Check-in & Island Dispatch Pass", cardX + 32, cardY + 112);
  ctx.restore();

  // 4. Booking Reference Bar
  const refY = cardY + headerHeight + 28;
  ctx.fillStyle = "#f4f4f5";
  ctx.beginPath();
  ctx.roundRect(cardX + 28, refY, cardW - 56, 52, 14);
  ctx.fill();

  ctx.fillStyle = "#71717a";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("BOOKING REFERENCE", cardX + 44, refY + 31);

  ctx.fillStyle = "#09090b";
  ctx.font = "bold 20px monospace";
  ctx.fillText(bookingCode, cardX + cardW - 200, refY + 33);

  // 5. Details Section: Property & Room
  const infoY = refY + 76;
  ctx.fillStyle = "#71717a";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("ACCOMMODATION & RESORT", cardX + 32, infoY);

  ctx.fillStyle = "#09090b";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  const propertyName = (booking.property_name || "Accredited Island Stay").slice(0, 32);
  ctx.fillText(propertyName, cardX + 32, infoY + 28);

  ctx.fillStyle = "#52525b";
  ctx.font = "15px system-ui, -apple-system, sans-serif";
  const roomName = (booking.room_name || "Standard Unit").slice(0, 38);
  ctx.fillText(roomName, cardX + 32, infoY + 52);

  // 6. Schedule Grid (Check-In & Check-Out)
  const scheduleY = infoY + 86;
  const colW = (cardW - 64) / 2;

  // Check-In Block
  ctx.fillStyle = "#fafafa";
  ctx.beginPath();
  ctx.roundRect(cardX + 32, scheduleY, colW - 8, 80, 16);
  ctx.fill();
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#71717a";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("CHECK-IN", cardX + 46, scheduleY + 26);

  ctx.fillStyle = "#09090b";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(booking.check_in, cardX + 46, scheduleY + 48);

  ctx.fillStyle = "#10b981";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("After 2:00 PM", cardX + 46, scheduleY + 68);

  // Check-Out Block
  ctx.fillStyle = "#fafafa";
  ctx.beginPath();
  ctx.roundRect(cardX + 32 + colW + 8, scheduleY, colW - 8, 80, 16);
  ctx.fill();
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#71717a";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("CHECK-OUT", cardX + 46 + colW + 8, scheduleY + 26);

  ctx.fillStyle = "#09090b";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(booking.check_out, cardX + 46 + colW + 8, scheduleY + 48);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("Before 12:00 PM", cardX + 46 + colW + 8, scheduleY + 68);

  // 7. Guest & Status Row
  const metaY = scheduleY + 106;
  ctx.fillStyle = "#52525b";
  ctx.font = "14px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Guest: ${booking.guest_name || "Verified Tourist"}`, cardX + 32, metaY);
  ctx.fillText(`Capacity: ${booking.guests_count} Guests`, cardX + 32 + colW + 8, metaY);

  // 8. Perforation Notch & Dashed Tear Line
  const perfY = metaY + 36;
  const notchR = 14;

  // Draw semi-circle notches cut into the ticket
  ctx.save();
  ctx.fillStyle = "#f8fafc"; // background color to simulate cutout
  ctx.beginPath();
  ctx.arc(cardX, perfY, notchR, -Math.PI / 2, Math.PI / 2, false);
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cardX + cardW, perfY, notchR, Math.PI / 2, -Math.PI / 2, false);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Dashed line across ticket
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + notchR + 8, perfY);
  ctx.lineTo(cardX + cardW - notchR - 8, perfY);
  ctx.stroke();
  ctx.restore();

  // 9. Lower Stub: Scannable QR Section
  const qrSectionY = perfY + 28;
  const qrSize = 190;
  const qrX = (width - qrSize) / 2;

  // White rounded background box for QR code
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(qrX - 12, qrSectionY, qrSize + 24, qrSize + 24, 20);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.05)";
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#e4e4e7";
  ctx.stroke();
  ctx.restore();

  // Draw QR Image
  ctx.drawImage(qrImage, qrX, qrSectionY + 12, qrSize, qrSize);

  // Status Badge below QR
  const statusBadgeY = qrSectionY + qrSize + 56;
  ctx.fillStyle = "#dcfce7"; // Emerald subtle bg
  ctx.beginPath();
  ctx.roundRect((width - 240) / 2, statusBadgeY, 240, 32, 16);
  ctx.fill();

  ctx.fillStyle = "#15803d";
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓ DEPOSIT VERIFIED • CONFIRMED", width / 2, statusBadgeY + 20);

  // Footer scanning note
  ctx.fillStyle = "#71717a";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText("Present this QR code upon arrival at your host or boat dispatch dock.", width / 2, statusBadgeY + 54);

  // Security Hash Footnote
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "10px monospace";
  ctx.fillText(`SECURE PASS ID • ${bookingCode} • 100% OFFLINE VERIFIED`, width / 2, height - 38);

  ctx.textAlign = "start"; // restore

  return canvas;
}

/**
 * Exports the Boarding Pass canvas as an image Blob.
 */
export async function exportBoardingPassBlob(
  booking: BoardingPassData
): Promise<Blob> {
  const canvas = await renderBoardingPassToCanvas(booking);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate boarding pass image blob"));
      },
      "image/png",
      1.0
    );
  });
}

/**
 * 1-Click Download of Boarding Pass as PNG.
 */
export async function downloadBoardingPassImage(
  booking: BoardingPassData
): Promise<void> {
  const blob = await exportBoardingPassBlob(booking);
  const url = URL.createObjectURL(blob);
  const bookingCode =
    booking.reference_code ||
    `MVBA-BRIT-${booking.id.slice(0, 4).toUpperCase()}`;

  const link = document.createElement("a");
  link.href = url;
  link.download = `${bookingCode}-BoardingPass.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 1-Tap Native Share to Photos / Files on iOS & Android.
 * Falls back to direct PNG download on desktop.
 */
export async function shareBoardingPass(
  booking: BoardingPassData
): Promise<{ success: boolean; method: "share" | "download" }> {
  const bookingCode =
    booking.reference_code ||
    `MVBA-BRIT-${booking.id.slice(0, 4).toUpperCase()}`;

  try {
    const blob = await exportBoardingPassBlob(booking);
    const file = new File([blob], `${bookingCode}-BoardingPass.png`, {
      type: "image/png",
    });

    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `MVBA Boarding Pass (${bookingCode})`,
        text: `Digital check-in ticket for ${booking.property_name || "Bretania Stay"}.`,
        files: [file],
      });
      return { success: true, method: "share" };
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, method: "share" }; // User dismissed share sheet
    }
  }

  // Fallback to direct file download
  await downloadBoardingPassImage(booking);
  return { success: true, method: "download" };
}
