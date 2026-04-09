"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export interface FilterState {
  department: string;
  priority: string;
  search: string;
}

interface DashboardFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  departments: { id: string; name: string }[];
}

export function DashboardFilters({
  filters,
  onChange,
  departments,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
      {/* Department filter */}
      <Select
        value={filters.department}
        onValueChange={(val) => onChange({ ...filters, department: val })}
      >
        <SelectTrigger className="w-full sm:w-[180px] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <SelectValue placeholder="All Departments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={filters.priority}
        onValueChange={(val) => onChange({ ...filters, priority: val })}
      >
        <SelectTrigger className="w-full sm:w-[140px] bg-[var(--bg-secondary)] text-[var(--text-primary)]">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          placeholder="Search room or request..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full sm:w-[220px] bg-[var(--bg-secondary)] pl-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
        />
      </div>
    </div>
  );
}
