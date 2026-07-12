"use client";

import { CalendarDays, CheckCircle2, Clock, Users2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { AttendanceRecord, AttendanceStatus, User } from "@/types/crm";
import { Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

const MARKABLE: AttendanceStatus[] = ["Present", "Absent", "Half Day", "Leave", "Week Off"];

const CELL_TONE: Record<AttendanceStatus, string> = {
  Present: "bg-green-100 text-green-700",
  Absent: "bg-red-100 text-red-700",
  "Half Day": "bg-yellow-100 text-yellow-700",
  Leave: "bg-orange-100 text-orange-700",
  "Week Off": "bg-slate-100 text-slate-400"
};

const LETTER: Record<AttendanceStatus, string> = {
  Present: "P",
  Absent: "A",
  "Half Day": "H",
  Leave: "L",
  "Week Off": "O"
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function checkTimes(status: AttendanceStatus): Pick<AttendanceRecord, "checkIn" | "checkOut"> {
  if (status === "Present") return { checkIn: "09:30", checkOut: "18:30" };
  if (status === "Half Day") return { checkIn: "09:30", checkOut: "13:30" };
  return {};
}

/**
 * Staff attendance: mark a day's attendance per staff member, review a full
 * monthly grid, and see month/day summary metrics.
 */
export function AttendanceView({
  users,
  records,
  onChange
}: {
  readonly users: User[];
  readonly records: AttendanceRecord[];
  readonly onChange: (records: AttendanceRecord[]) => void;
}) {
  const toast = useToast();
  const now = useMemo(() => new Date(), []);
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [markDate, setMarkDate] = useState(todayIso);
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);

  const staff = useMemo(() => users.filter((user) => user.role === "Staff"), [users]);
  const activeStaff = useMemo(() => staff.filter((user) => user.status === "Active"), [staff]);

  const byId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((record) => map.set(record.id, record));
    return map;
  }, [records]);

  function statusFor(userId: string, date: string): AttendanceStatus | undefined {
    return byId.get(`${userId}_${date}`)?.status;
  }

  function mark(userId: string, date: string, status: AttendanceStatus) {
    const id = `${userId}_${date}`;
    const record: AttendanceRecord = { id, userId, date, status, ...checkTimes(status) };
    onChange(byId.has(id) ? records.map((item) => (item.id === id ? record : item)) : [...records, record]);
    const name = users.find((user) => user.id === userId)?.name ?? "Staff";
    toast(`${name} · ${status}`);
  }

  // Today snapshot metrics.
  const presentToday = activeStaff.filter((user) => statusFor(user.id, todayIso) === "Present").length;
  const leaveToday = activeStaff.filter((user) => statusFor(user.id, todayIso) === "Leave").length;

  // Month grid setup.
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const summaries = staff.map((user) => {
    const counts = { Present: 0, Absent: 0, "Half Day": 0, Leave: 0, "Week Off": 0 } as Record<AttendanceStatus, number>;
    days.forEach((day) => {
      const status = statusFor(user.id, `${month}-${pad(day)}`);
      if (status) counts[status] += 1;
    });
    const workingDays = counts.Present + counts.Absent + counts["Half Day"] + counts.Leave;
    const pct = workingDays ? Math.round(((counts.Present + counts["Half Day"] * 0.5) / workingDays) * 100) : 0;
    return { user, counts, pct, workingDays };
  });

  // Average only over staff who have marked days this month, so empty rows don't skew it.
  const rated = summaries.filter((item) => item.workingDays > 0);
  const avgAttendance = rated.length ? Math.round(rated.reduce((sum, item) => sum + item.pct, 0) / rated.length) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Staff" value={staff.length} icon={Users2} />
        <Metric label="Present Today" value={presentToday} icon={CheckCircle2} tone="text-green-600 bg-green-50" />
        <Metric label="On Leave Today" value={leaveToday} icon={Clock} tone="text-orange-600 bg-orange-50" />
        <Metric label="Avg Attendance" value={`${avgAttendance}%`} icon={CalendarDays} />
      </div>

      <Panel
        title="Mark Attendance"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Date
            <input
              type="date"
              value={markDate}
              max={todayIso}
              onChange={(event) => setMarkDate(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
        }
      >
        {activeStaff.length ? (
          <div className="space-y-3">
            {activeStaff.map((user) => {
              const current = statusFor(user.id, markDate);
              return (
                <div key={user.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.department}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MARKABLE.map((status) => (
                      <button
                        key={status}
                        onClick={() => mark(user.id, markDate, status)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                          current === status ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No active staff to mark. Add or activate staff in the Users module.</p>
        )}
      </Panel>

      <Panel
        title="Monthly Attendance"
        action={
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {MARKABLE.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn("grid h-5 w-5 place-items-center rounded text-[10px] font-bold", CELL_TONE[status])}>{LETTER[status]}</span>
              {status}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Staff</th>
                {days.map((day) => (
                  <th key={day} className="w-8 px-0 py-2 text-center text-[11px] font-semibold text-slate-400">
                    {day}
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">P</th>
                <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">A</th>
                <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">L</th>
                <th className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">%</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(({ user, counts, pct }) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-semibold text-slate-800">{user.name}</td>
                  {days.map((day) => {
                    const status = statusFor(user.id, `${month}-${pad(day)}`);
                    return (
                      <td key={day} className="px-0.5 py-1 text-center">
                        {status ? (
                          <span className={cn("mx-auto grid h-6 w-6 place-items-center rounded text-[11px] font-bold", CELL_TONE[status])} title={status}>
                            {LETTER[status]}
                          </span>
                        ) : (
                          <span className="text-slate-300">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-green-700">{counts.Present}</td>
                  <td className="px-2 py-2 text-center font-semibold text-red-600">{counts.Absent}</td>
                  <td className="px-2 py-2 text-center font-semibold text-orange-600">{counts.Leave}</td>
                  <td className={cn("px-3 py-2 text-center font-bold", pct >= 90 ? "text-green-700" : pct >= 75 ? "text-amber-600" : "text-red-600")}>{pct}%</td>
                </tr>
              ))}
              {!summaries.length && (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-slate-500" colSpan={days.length + 5}>
                    No staff records for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone = "text-blue-600 bg-blue-50" }: { readonly label: string; readonly value: string | number; readonly icon: typeof Users2; readonly tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        <div className={cn("grid h-11 w-11 place-items-center rounded-lg", tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
