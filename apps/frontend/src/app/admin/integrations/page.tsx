"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plug,
  Loader2,
  Plus,
  Pencil,
  Play,
  ScrollText,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { isAuthenticated, getUser, getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";

interface Integration {
  id: string;
  name: string;
  provider: string;
  trigger: string;
  enabled: boolean;
  success_rate?: number;
  config?: Record<string, unknown>;
}

interface IntegrationEvent {
  id: string;
  timestamp: string;
  status: string;
  response_code?: number;
  message?: string;
}

export default function IntegrationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  // Test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Logs dialog
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsData, setLogsData] = useState<IntegrationEvent[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Add dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formProvider, setFormProvider] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [saving, setSaving] = useState(false);

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

  const fetchIntegrations = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const raw = await apiRequest<Integration[] | { data: Integration[] }>("/api/integrations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIntegrations(Array.isArray(raw) ? raw : raw.data);
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchIntegrations();
  }, [ready, fetchIntegrations]);

  const handleTest = async (integration: Integration) => {
    const token = getToken();
    if (!token) return;
    setTestResult(null);
    setTesting(true);
    setTestDialogOpen(true);

    try {
      const result = await apiRequest<{ success: boolean; message: string }>(
        `/api/integrations/${integration.id}/test`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Test failed -- could not reach endpoint." });
    } finally {
      setTesting(false);
    }
  };

  const handleViewLogs = async (integration: Integration) => {
    const token = getToken();
    if (!token) return;
    setLogsData([]);
    setLogsLoading(true);
    setLogsDialogOpen(true);

    try {
      const data = await apiRequest<IntegrationEvent[]>(
        `/api/integrations/${integration.id}/events`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLogsData(data);
    } catch {
      // Failed
    } finally {
      setLogsLoading(false);
    }
  };

  const handleToggle = async (integration: Integration) => {
    const token = getToken();
    if (!token) return;

    try {
      await apiRequest(`/api/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !integration.enabled }),
      });
      fetchIntegrations();
    } catch {
      // Failed
    }
  };

  const handleAdd = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);

    try {
      await apiRequest("/api/integrations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formName,
          provider: formProvider,
          trigger: formTrigger,
        }),
      });
      setAddDialogOpen(false);
      fetchIntegrations();
    } catch {
      // Failed
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setFormName("");
    setFormProvider("");
    setFormTrigger("");
    setAddDialogOpen(true);
  };

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
            <Plug className="h-5 w-5 text-[var(--accent-purple)]" />
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Integrations
            </h2>
            {integrations.length > 0 && (
              <span className="rounded-full bg-[var(--accent-purple)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent-purple)]">
                {integrations.length}
              </span>
            )}
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Integration
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : integrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Plug className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                No integrations configured
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Connect your first external service.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((intg) => (
                    <TableRow key={intg.id}>
                      <TableCell className="font-medium text-[var(--text-primary)]">
                        {intg.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {intg.provider}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                        {intg.trigger}
                      </TableCell>
                      <TableCell>
                        {intg.enabled ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Disabled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {intg.success_rate != null ? (
                          <span
                            className={`font-mono text-xs font-bold ${
                              intg.success_rate >= 95
                                ? "text-[var(--accent-green)]"
                                : intg.success_rate >= 80
                                  ? "text-[var(--accent-amber)]"
                                  : "text-[var(--accent-red)]"
                            }`}
                          >
                            {intg.success_rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTest(intg)}
                            title="Test"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewLogs(intg)}
                            title="Logs"
                          >
                            <ScrollText className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(intg)}
                            title={intg.enabled ? "Disable" : "Enable"}
                          >
                            {intg.enabled ? (
                              <ToggleRight className="h-3.5 w-3.5 text-[var(--accent-green)]" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Test Result Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Integration Test</DialogTitle>
            <DialogDescription>Result of the test request.</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            {testing ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--text-muted)]" />
            ) : testResult ? (
              <div className="flex flex-col items-center gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="h-10 w-10 text-[var(--accent-green)]" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-[var(--accent-red)]" />
                )}
                <p className="text-sm text-[var(--text-secondary)]">
                  {testResult.message}
                </p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Integration Events</DialogTitle>
            <DialogDescription>Recent event history.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : logsData.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--text-muted)]">
                No events recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-[var(--text-muted)]">
                        {new Date(evt.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            evt.status === "success" ? "success" : "destructive"
                          }
                        >
                          {evt.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-secondary)]">
                        {evt.response_code ?? "--"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-[var(--text-secondary)]">
                        {evt.message ?? "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Integration Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add Integration</DialogTitle>
            <DialogDescription>
              Connect a new external service.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Slack Notifications"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Provider
              </label>
              <Input
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                placeholder="e.g. slack, webhook, pms"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Trigger
              </label>
              <Input
                value={formTrigger}
                onChange={(e) => setFormTrigger(e.target.value)}
                placeholder="e.g. request.created, request.escalated"
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                saving || !formName.trim() || !formProvider.trim()
              }
              className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
