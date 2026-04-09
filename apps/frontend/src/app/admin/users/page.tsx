"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Loader2,
  Plus,
  UserPlus,
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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  department_name?: string;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  slug: string;
}

const roleBadgeVariant: Record<string, "default" | "secondary" | "warning" | "destructive" | "success"> = {
  admin: "destructive",
  manager: "warning",
  staff: "default",
  guest: "secondary",
};

export default function UsersPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("staff");
  const [formDept, setFormDept] = useState("");
  const [formPassword, setFormPassword] = useState("");
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

  const fetchUsers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiRequest<OrgUser[]>("/api/org/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data);
    } catch {
      // Failed to fetch
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiRequest<Department[]>("/api/org/departments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartments(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchUsers();
    fetchDepartments();
  }, [ready, fetchUsers, fetchDepartments]);

  const openInvite = () => {
    setFormName("");
    setFormEmail("");
    setFormRole("staff");
    setFormDept("");
    setFormPassword("");
    setDialogOpen(true);
  };

  const handleInvite = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);

    try {
      await apiRequest("/api/org/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          role: formRole,
          department_id: formDept || null,
          password: formPassword,
        }),
      });
      setDialogOpen(false);
      fetchUsers();
    } catch {
      // Failed
    } finally {
      setSaving(false);
    }
  };

  const deptNameMap = new Map(departments.map((d) => [d.id, d.name]));

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
            <Users className="h-5 w-5 text-[var(--accent-green)]" />
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Users
            </h2>
            {users.length > 0 && (
              <span className="rounded-full bg-[var(--accent-green)]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--accent-green)]">
                {users.length}
              </span>
            )}
          </div>
          <Button size="sm" onClick={openInvite}>
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Invite User
          </Button>
        </header>

        <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Users className="mb-4 h-10 w-10 text-[var(--text-muted)]" />
              <h3 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                No users found
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Invite your first team member.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-[var(--text-primary)]">
                        {u.name}
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant[u.role] ?? "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[var(--text-secondary)]">
                        {u.department_name ??
                          (u.department_id ? deptNameMap.get(u.department_id) ?? u.department_id.slice(0, 8) : "--")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-muted)]">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString()
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Invite User</DialogTitle>
            <DialogDescription>
              Add a new team member to your organization.
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
                placeholder="Full name"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Email
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="user@hotel.com"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Role
              </label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Department
              </label>
              <Select value={formDept} onValueChange={setFormDept}>
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Password
              </label>
              <Input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Initial password"
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
              onClick={handleInvite}
              disabled={
                saving ||
                !formName.trim() ||
                !formEmail.trim() ||
                !formPassword.trim()
              }
              className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80"
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
