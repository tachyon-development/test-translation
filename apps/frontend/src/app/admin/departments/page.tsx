"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  CheckCircle2,
  XCircle,
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

interface Department {
  id: string;
  name: string;
  slug: string;
  sla_config: Record<string, unknown> | null;
  escalation_contact: string | null;
  active: boolean;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formContact, setFormContact] = useState("");
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

  const fetchDepartments = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiRequest<Department[]>("/api/org/departments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartments(data);
    } catch {
      // Failed to fetch
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchDepartments();
  }, [ready, fetchDepartments]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormSlug("");
    setFormContact("");
    setDialogOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setFormName(dept.name);
    setFormSlug(dept.slug);
    setFormContact(dept.escalation_contact ?? "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);

    const body = {
      name: formName,
      slug: formSlug,
      escalation_contact: formContact || null,
    };

    try {
      if (editing) {
        await apiRequest(`/api/org/departments/${editing.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest("/api/org/departments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
      }
      setDialogOpen(false);
      fetchDepartments();
    } catch {
      // Failed to save
    } finally {
      setSaving(false);
    }
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
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-[var(--accent-blue)]" />
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Departments
            </h2>
            {departments.length > 0 && (
              <span className="rounded-full bg-[var(--accent-blue)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent-blue)]">
                {departments.length}
              </span>
            )}
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Department
          </Button>
        </header>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Building2 className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                No departments yet
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Create your first department to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>SLA Config</TableHead>
                    <TableHead>Escalation Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium text-[var(--text-primary)]">
                        {dept.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-secondary)]">
                        {dept.slug}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                        {dept.sla_config
                          ? JSON.stringify(dept.sla_config).slice(0, 40) +
                            (JSON.stringify(dept.sla_config).length > 40 ? "..." : "")
                          : "--"}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {dept.escalation_contact ?? "--"}
                      </TableCell>
                      <TableCell>
                        {dept.active ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(dept)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Department" : "Add Department"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update department details."
                : "Create a new department for your organization."}
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
                placeholder="e.g. Housekeeping"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Slug
              </label>
              <Input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="e.g. housekeeping"
                className="bg-white/5 border-white/10 font-mono"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Escalation Contact
              </label>
              <Input
                value={formContact}
                onChange={(e) => setFormContact(e.target.value)}
                placeholder="e.g. manager@hotel.com"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formSlug.trim()}
              className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
