"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ScrollText,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { isAuthenticated, getUser, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorId: string | null;
  actor: { id: string; name: string; role: string } | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
}

interface AuditResponse {
  data: AuditEntry[];
  total?: number;
  page?: number;
  limit?: number;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

const LIMIT = 50;

const actionColor: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  create: "success",
  update: "warning",
  delete: "destructive",
  login: "default",
  logout: "secondary",
};

export default function AuditLogPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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

  const fetchAudit = useCallback(
    async (p: number) => {
      const token = getToken();
      if (!token) return;
      setLoading(true);

      try {
        // Try paginated response format first
        const raw = await apiRequest<AuditResponse | AuditEntry[]>(
          `/api/org/audit-log?page=${p}&limit=${LIMIT}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (Array.isArray(raw)) {
          setEntries(raw);
          setTotal(raw.length);
        } else {
          setEntries(raw.data);
          setTotal(raw.pagination?.total ?? raw.total ?? raw.data.length);
        }
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!ready) return;
    fetchAudit(page);
  }, [ready, page, fetchAudit]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <ScrollText className="h-5 w-5 text-[var(--status-warning,#c9a84c)]" />
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Audit Log
            </h2>
            {total > 0 && (
              <span className="rounded-full bg-[var(--status-warning,#c9a84c)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--status-warning,#c9a84c)]">
                {total}
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ScrollText className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                No audit entries
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Activity will appear here as actions occur.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource Type</TableHead>
                    <TableHead>Resource ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-[var(--text-muted)]">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {entry.actor?.name ?? entry.actorId?.slice(0, 8) ?? "System"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={actionColor[entry.action] ?? "secondary"}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {entry.resourceType}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                        {entry.resourceId?.slice(0, 12) ?? "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 md:px-6">
            <p className="text-xs text-[var(--text-muted)]">
              Page{" "}
              <span className="font-mono font-bold text-[var(--text-secondary)]">
                {page}
              </span>{" "}
              of{" "}
              <span className="font-mono font-bold text-[var(--text-secondary)]">
                {totalPages}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
