"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_BASE_URL = "https://hospiq.local";

interface QRCodeGeneratorProps {
  roomNumber: string;
  orgSlug: string;
  orgName: string;
  baseUrl?: string;
}

/**
 * Generates a QR code card for a hotel room.
 * Renders both a screen-optimized (dark) and print-optimized (white) version.
 */
export function QRCodeGenerator({
  roomNumber,
  orgSlug,
  orgName,
  baseUrl = DEFAULT_BASE_URL,
}: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);

  const url = `${baseUrl}/${orgSlug}/room/${roomNumber}`;

  // Generate QR code SVG for display
  useEffect(() => {
    QRCode.toString(url, {
      type: "svg",
      width: 200,
      margin: 2,
      color: {
        dark: "#1a1a2e",
        light: "#f5f0eb",
      },
      errorCorrectionLevel: "M",
    }).then(setSvgMarkup);
  }, [url]);

  // Download as PNG
  const handleDownload = useCallback(async () => {
    const canvas = document.createElement("canvas");
    const scale = 3; // High-res output
    const cardW = 320;
    const cardH = 440;
    canvas.width = cardW * scale;
    canvas.height = cardH * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    // White background for print
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 0, 0, cardW, cardH, 16);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = "#e0dcd7";
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, cardW - 1, cardH - 1, 16);
    ctx.stroke();

    // Generate QR as data URL for the canvas
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#1a1a2e",
        light: "#f5f0eb",
      },
      errorCorrectionLevel: "M",
    });

    // Draw QR code
    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
    });

    const qrSize = 200;
    const qrX = (cardW - qrSize) / 2;
    const qrY = 40;

    // QR background with rounded corners
    ctx.fillStyle = "#f5f0eb";
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
    ctx.fill();

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Gold accent line
    ctx.fillStyle = "#d4a574";
    ctx.fillRect(60, qrY + qrSize + 24, cardW - 120, 2);

    // Room number — using serif-style font
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 28px 'Cormorant Garamond', 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.fillText(`Room ${roomNumber}`, cardW / 2, qrY + qrSize + 64);

    // Org name
    ctx.fillStyle = "#6b6b80";
    ctx.font = "italic 18px 'Cormorant Garamond', 'Georgia', serif";
    ctx.fillText(orgName, cardW / 2, qrY + qrSize + 92);

    // Instruction
    ctx.fillStyle = "#a0a0b0";
    ctx.font = "13px 'DM Sans', 'Helvetica Neue', sans-serif";
    ctx.fillText("Scan to request assistance", cardW / 2, qrY + qrSize + 130);

    // Convert to PNG and download
    const link = document.createElement("a");
    link.download = `qr-room-${roomNumber}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [url, roomNumber, orgName]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Dark card for screen display */}
      <div
        ref={cardRef}
        className="flex w-[320px] flex-col items-center rounded-2xl border border-white/10 bg-[var(--bg-secondary)] p-8 shadow-xl"
      >
        {/* QR Code */}
        <div
          className="rounded-xl bg-[#f5f0eb] p-3"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />

        {/* Gold accent line */}
        <div className="my-5 h-[2px] w-3/4 bg-[var(--accent,#d4a574)]" />

        {/* Room number */}
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">
          Room {roomNumber}
        </p>

        {/* Org name */}
        <p className="mt-1 font-[family-name:var(--font-display)] text-base italic text-[var(--text-muted)]">
          {orgName}
        </p>

        {/* Instruction */}
        <p className="mt-4 text-xs tracking-wide text-[var(--text-secondary)]">
          Scan to request assistance
        </p>
      </div>

      {/* Download button */}
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" />
        Download PNG
      </Button>
    </div>
  );
}

/**
 * Generate a PNG data URL for a room QR card (used for batch downloads).
 */
export async function generateQRCardPNG(
  roomNumber: string,
  orgSlug: string,
  orgName: string,
  baseUrl: string = DEFAULT_BASE_URL,
): Promise<string> {
  const url = `${baseUrl}/${orgSlug}/room/${roomNumber}`;

  const canvas = document.createElement("canvas");
  const scale = 3;
  const cardW = 320;
  const cardH = 440;
  canvas.width = cardW * scale;
  canvas.height = cardH * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // White background for print
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, cardW, cardH, 16);
  ctx.fill();

  ctx.strokeStyle = "#e0dcd7";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, cardW - 1, cardH - 1, 16);
  ctx.stroke();

  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 200,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#f5f0eb" },
    errorCorrectionLevel: "M",
  });

  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise<void>((resolve) => {
    qrImg.onload = () => resolve();
  });

  const qrSize = 200;
  const qrX = (cardW - qrSize) / 2;
  const qrY = 40;

  ctx.fillStyle = "#f5f0eb";
  roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
  ctx.fill();

  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "#d4a574";
  ctx.fillRect(60, qrY + qrSize + 24, cardW - 120, 2);

  ctx.fillStyle = "#1a1a2e";
  ctx.font = "bold 28px 'Cormorant Garamond', 'Georgia', serif";
  ctx.textAlign = "center";
  ctx.fillText(`Room ${roomNumber}`, cardW / 2, qrY + qrSize + 64);

  ctx.fillStyle = "#6b6b80";
  ctx.font = "italic 18px 'Cormorant Garamond', 'Georgia', serif";
  ctx.fillText(orgName, cardW / 2, qrY + qrSize + 92);

  ctx.fillStyle = "#a0a0b0";
  ctx.font = "13px 'DM Sans', 'Helvetica Neue', sans-serif";
  ctx.fillText("Scan to request assistance", cardW / 2, qrY + qrSize + 130);

  return canvas.toDataURL("image/png");
}

// Utility: draw a rounded rectangle path
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
