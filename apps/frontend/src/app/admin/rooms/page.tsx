"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode, Download, DoorOpen } from "lucide-react";
import { isAuthenticated, getUser, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeGenerator, generateQRCardPNG } from "@/components/admin/QRCodeGenerator";

interface Room {
  id: string;
  number: string;
  floor: number | null;
  zone: string | null;
}

const ORG_SLUG = "hotel-mariana";
const ORG_NAME = "Hotel Mariana";

export default function AdminRoomsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Auth check — require admin
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    if (user && user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router]);

  // Fetch rooms
  useEffect(() => {
    if (!ready) return;
    const token = getToken();
    if (!token) return;

    const fetchRooms = async () => {
      try {
        const data = await apiRequest<Room[]>("/api/org/rooms", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRooms(data);
      } catch {
        // Failed to fetch rooms
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [ready]);

  // Download all QR codes as individual PNG files
  const handleDownloadAll = useCallback(async () => {
    setDownloading(true);
    try {
      for (const room of rooms) {
        const dataUrl = await generateQRCardPNG(
          room.number,
          ORG_SLUG,
          ORG_NAME,
        );
        const link = document.createElement("a");
        link.download = `qr-room-${room.number}.png`;
        link.href = dataUrl;
        link.click();
        // Small delay between downloads to avoid browser throttling
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setDownloading(false);
    }
  }, [rooms]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <AppShell activePage="admin">
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <DoorOpen className="h-5 w-5 text-[var(--accent,#d4a574)]" />
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
              Rooms
            </h2>
            {rooms.length > 0 && (
              <span className="rounded-full bg-[var(--accent,#d4a574)]/10 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--accent,#d4a574)]">
                {rooms.length}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloading || rooms.length === 0}
          >
            {downloading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            {downloading ? "Downloading..." : "Download All QRs"}
          </Button>
        </header>

        {/* Room table */}
        <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <DoorOpen className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                No rooms found
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Add rooms via the API to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Room</TableHead>
                  <TableHead className="w-[80px]">Floor</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-[family-name:var(--font-mono)] font-medium text-[var(--text-primary)]">
                      {room.number}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {room.floor ?? "-"}
                    </TableCell>
                    <TableCell className="text-[var(--text-secondary)]">
                      {room.zone ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRoom(room)}
                      >
                        <QrCode className="mr-1.5 h-3.5 w-3.5" />
                        Generate QR
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      {/* QR Code Preview Dialog */}
      <Dialog
        open={selectedRoom !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRoom(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-display)]">
              QR Code — Room {selectedRoom?.number}
            </DialogTitle>
            <DialogDescription>
              Print or download this QR code for the room.
            </DialogDescription>
          </DialogHeader>
          {selectedRoom && (
            <div className="flex justify-center py-4">
              <QRCodeGenerator
                roomNumber={selectedRoom.number}
                orgSlug={ORG_SLUG}
                orgName={ORG_NAME}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
