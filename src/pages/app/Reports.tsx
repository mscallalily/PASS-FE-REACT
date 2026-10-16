import React, { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import {
  Download,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  Car,
  ParkingSquare,
  ShieldCheck,
  ChevronRight,
  Clock,
  Info,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  PageHeader,
  Card,
  Button,
  Input,
  Select,
  StatCard,
  Table,
  Modal,
  Badge,
} from "../../components/ui"
import { apiRequest, apiBlob } from "../../lib/apiClient"
import { formatCampusDateTime } from "../../lib/datetime"
import {
  REPORT_CATEGORIES,
  defaultFilters,
  reportQuery,
  filterKeys,
  reportStatuses,
  campusDate,
  type ReportFilters,
} from "../../lib/reportConfig"

type ReportRow = Record<string, unknown>
type Metric = { label: string; value: number | null; unit?: string }
type Report = {
  data: ReportRow[]
  summary: Metric[]
  charts: {
    daily?: { label: string; cars: number; motorcycles: number; records: number }[]
    status?: { name: string; value: number }[]
    hourly?: { hour: string; value: number }[]
    heatmap?: { weekday: number; hour: number; value: number }[]
    busiest_hour?: string | null
    least_busy_hour?: string | null
    occupancy?: { label: string; cars: number; motorcycles: number }[]
  }
  meta: {
    title: string
    category: string
    generated_at: string
    generated_by: string
    total_records: number
    date_basis: string
    columns: Record<string, string>
    notes: string[]
    filters: Record<string, string>
  }
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  snapshot: {
    overall: {
      capacity: number
      occupied: number
      available: number
      maintenance: number
      occupancy_percent: number
    }
    inside: { total: number; consistent: boolean }
    areas: {
      parking_area_id: number
      area_name: string
      capacity: number
      occupied: number
      available: number
      occupancy_percent: number
    }[]
    today_entries: number
    today_exits: number
    today_denied: number
    status: string
    campus_date: string
  }
  areas: { parking_area_id: number; area_name: string }[]
}
const COLORS = [
  "#080677",
  "#D4A72C",
  "#38BDF8",
  "#14B8A6",
  "#EF4444",
  "#94A3B8",
]
function label(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (s) => s.toUpperCase())
}
function display(value: unknown, key: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (["occurred_at", "entry_at", "exit_at"].includes(key))
    return formatCampusDateTime(String(value))
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  if (typeof value === "number")
    return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(
      value,
    )
  return String(value)
}
function readFilters(params: URLSearchParams): ReportFilters {
  const defaults = defaultFilters()
  for (const key of Object.keys(defaults) as Array<keyof ReportFilters>)
    if (params.has(key)) defaults[key] = params.get(key)!
  return defaults
}
function ReportCharts({
  report,
  category,
  dataset,
}: {
  report: Report
  category: string
  dataset: string
}) {
  const chart = report.charts
  const entries = ["overview", "entry-exit"].includes(category)
  const activityTitle = entries
    ? "Vehicle entries by period"
    : "Matching records by period"
  const heat = chart.heatmap ?? []
  const max = Math.max(1, ...heat.map((p) => Number(p.value)))
  return (
    <div className="space-y-5">
      <div className="grid xl:grid-cols-2 gap-5">
        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="font-semibold text-[#080677]">
            {category === "occupancy"
              ? "Recorded occupancy over time"
              : activityTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {category === "occupancy"
              ? "Average concurrent vehicles per bucket · car and motorcycle areas"
              : "All matching records across every page · Manila time"}
          </p>
          {category === "occupancy" ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart.occupancy ?? []}>
                <XAxis
                  dataKey="label"
                  minTickGap={35}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  dataKey="cars"
                  name="Cars"
                  stroke={COLORS[0]}
                  dot={false}
                />
                <Line
                  dataKey="motorcycles"
                  name="Motorcycles"
                  stroke={COLORS[1]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={(chart.daily ?? []).map(point => ({ ...point, unidentified: Math.max(0, point.records - point.cars - point.motorcycles) }))}>
                <XAxis
                  dataKey="label"
                  minTickGap={30}
                  tick={{ fontSize: 10 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {["users", "audit"].includes(category) ||
                (category === "rfid" && dataset === "devices") ? (
                  <Bar
                    dataKey="records"
                    name="Records"
                    fill={COLORS[0]}
                    radius={[4, 4, 0, 0]}
                  />
                ) : (
                  <>
                    <Bar
                      dataKey="cars"
                      name="Cars"
                      fill={COLORS[0]}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="motorcycles"
                      name="Motorcycles"
                      fill={COLORS[1]}
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar dataKey="unidentified" name="Unidentified / other" fill={COLORS[5]} radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="font-semibold text-[#080677]">
            {category === "occupancy"
              ? "Current parking areas"
              : "Status distribution"}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {category === "occupancy"
              ? "Campus-wide snapshot now · independent of historical filters"
              : "The same filtered dataset as the table and exports"}
          </p>
          {category === "occupancy" ? (
            <div className="space-y-5">
              {report.snapshot.areas.map((a) => (
                <div key={a.parking_area_id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{a.area_name}</span>
                    <strong>
                      {a.occupied} / {a.capacity}
                    </strong>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#080677]"
                      style={{
                        width: `${Math.min(a.occupancy_percent, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.available} available · {a.occupancy_percent}% recorded
                    occupancy
                  </p>
                </div>
              ))}
            </div>
          ) : (chart.status ?? []).length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={(chart.status ?? []).map((s) => ({
                    ...s,
                    value: Number(s.value),
                    name: label(s.name),
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {(chart.status ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">
              No matching records.
            </p>
          )}
        </Card>
      </div>
      {chart.hourly && !(category === "rfid" && dataset === "devices") && (
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-[#080677]">
                {entries
                  ? "Entry activity by hour"
                  : "Recorded activity by hour"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Manila hours · zero-activity hours are included
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Busiest: <strong>{chart.busiest_hour ?? "—"}</strong> · Least
              busy: <strong>{chart.least_busy_hour ?? "—"}</strong>
            </p>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chart.hourly}>
              <XAxis dataKey="hour" minTickGap={25} tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar
                dataKey="value"
                name={entries ? "Entries" : "Records"}
                fill={COLORS[0]}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {entries && (
        <Card className="min-w-0 p-4 sm:p-5">
          <h2 className="font-semibold text-[#080677]">
            Entry activity heatmap
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Day of week × Manila hour · darker cells mean more entries. Scroll
            to see all hours.
          </p>
          <div className="max-w-full overflow-x-auto pb-2">
            <div
              className="grid min-w-[650px] gap-1"
              style={{
                gridTemplateColumns: "40px repeat(24, minmax(18px, 1fr))",
              }}
            >
              <span />
              {Array.from({ length: 24 }, (_, hour) => (
                <span
                  key={hour}
                  className="text-[10px] text-center text-slate-400"
                >
                  {hour}
                </span>
              ))}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, weekday) => (
                  <React.Fragment key={day}>
                    <span className="text-xs text-slate-500 self-center">
                      {day}
                    </span>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const value = Number(
                        heat.find(
                          (p) =>
                            Number(p.weekday) === weekday &&
                            Number(p.hour) === hour,
                        )?.value ?? 0,
                      )
                      return (
                        <span
                          key={hour}
                          title={`${day} ${hour}:00 · ${value} entries`}
                          aria-label={`${day} ${hour}:00, ${value} entries`}
                          className="h-6 rounded"
                          style={{
                            background: value
                              ? `rgba(8,6,119,${0.2 + (value / max) * 0.8})`
                              : "#F1F5F9",
                          }}
                        />
                      )
                    })}
                  </React.Fragment>
                ),
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
export default function Reports() {
  const { category: routeCategory } = useParams()
  const category = REPORT_CATEGORIES.some(([id]) => id === routeCategory)
    ? routeCategory!
    : "overview"
  const [params, setParams] = useSearchParams()
  const applied = readFilters(params)
  const appliedKey = reportQuery(category, applied).toString()
  const [draft, setDraft] = useState<ReportFilters>(applied)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exportError, setExportError] = useState("")
  const [exporting, setExporting] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<ReportRow | null>(null)
  const [formError, setFormError] = useState("")
  const page = Math.max(1, Number(params.get("page")) || 1)
  useEffect(() => {
    setDraft(readFilters(new URLSearchParams(appliedKey)))
    setSelected(null)
    setFormError("")
  }, [appliedKey])
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    setError("")
    setReport(null)
    setExportError("")
    void apiRequest<Report>(`/api/admin/reports?${appliedKey}&page=${page}`, {
      signal: abort.signal,
    })
      .then((data) => {
        if (!Array.isArray(data.data) || !data.meta?.columns || !data.snapshot)
          throw new Error(
            "Unexpected report response. Please update both frontend and backend.",
          )
        if (!abort.signal.aborted) setReport(data)
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load report.")
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [appliedKey, page, refresh])
  const dirty = reportQuery(category, draft).toString() !== appliedKey
  const supported = filterKeys(category, draft.dataset)
  function change(key: keyof ReportFilters, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "dataset"
        ? {
            status: "",
            area_id: "",
            user_type: "",
            vehicle_type: "",
            method: "",
          }
        : {}),
    }))
  }
  function preset(name: string) {
    const today = campusDate()
    const date = new Date(today + "T00:00:00+08:00")
    const ago = (days: number) =>
      campusDate(new Date(date.getTime() - days * 86400000))
    const from =
      name === "yesterday"
        ? ago(1)
        : name === "7"
          ? ago(6)
          : name === "30"
            ? ago(29)
            : name === "year"
              ? today.slice(0, 4) + "-01-01"
              : today
    setDraft((previous) => ({
      ...previous,
      date_from: from,
      date_to: name === "yesterday" ? ago(1) : today,
    }))
  }
  function apply(e: React.FormEvent) {
    e.preventDefault()
    const days =
      (Date.parse(draft.date_to) - Date.parse(draft.date_from)) / 86400000
    if (!Number.isFinite(days) || days < 0 || days > 365) {
      setFormError("Choose a valid period of 1 to 366 days.")
      return
    }
    setFormError("")
    const next = reportQuery(category, draft)
    next.delete("category")
    setParams(next)
    setRefresh((v) => v + 1)
  }
  function setPage(nextPage: number) {
    const next = new URLSearchParams(params)
    next.set("page", String(nextPage))
    setParams(next)
  }
  async function download(format: "csv" | "excel" | "print") {
    if (!report || dirty || loading || exporting) return
    setExporting(format)
    setExportError("")
    // Open synchronously during the user's click so browsers allow the print window.
    const printWindow = format === "print" ? window.open("", "_blank") : null
    if (printWindow) {
      printWindow.opener = null
      printWindow.document.title = "Preparing PASS report"
      printWindow.document.body.textContent = "Preparing all matching records…"
    }
    try {
      const blob = await apiBlob(
        `/api/admin/reports/export?${appliedKey}&format=${format}`,
      )
      const url = URL.createObjectURL(blob)
      if (format === "print") {
        if (!printWindow) {
          URL.revokeObjectURL(url)
          throw new Error(
            "Allow pop-ups for PASS to open the print / PDF report.",
          )
        }
        // The server renders and escapes every cell. Keep the print document in
        // this window so the print call runs after its markup is loaded.
        const html = await blob.text()
        printWindow.document.open()
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        URL.revokeObjectURL(url)
      } else {
        const a = document.createElement("a")
        a.href = url
        a.download = `PASS-${category}-${applied.date_from}-to-${applied.date_to}.${
          format === "excel" ? "xml" : "csv"
        }`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }
    } catch (e) {
      printWindow?.close()
      setExportError(
        e instanceof Error ? e.message : "Export failed. Please try again.",
      )
    } finally {
      setExporting("")
    }
  }
  const title = REPORT_CATEGORIES.find(([id]) => id === category)![1]
  const canExport =
    !loading && !!report?.pagination.total && !dirty && !exporting
  const snapshot = report?.snapshot
  const tableColumns = report
    ? Object.entries(report.meta.columns)
        .filter(
          ([key]) =>
            ![
              "details",
              "old_values",
              "new_values",
              "user_type",
              "user_code",
            ].includes(key),
        )
        .slice(0, 7)
        .map(([key, text]) => ({
          key,
          label: text,
          render: (row: ReportRow) =>
            key === "status" ? (
              <Badge
                variant={
                  [
                    "denied",
                    "rejected",
                    "integrity_warning",
                    "revoked",
                  ].includes(String(row[key]))
                    ? "danger"
                    : ["pending", "active", "open"].includes(String(row[key]))
                      ? "warning"
                      : "default"
                }
              >
                {label(String(row[key] ?? "—"))}
              </Badge>
            ) : (
              <span
                className={
                  key === "plate_number"
                    ? "font-mono font-semibold text-[#080677]"
                    : "break-words"
                }
              >
                {display(row[key], key)}
              </span>
            ),
        }))
    : []
  return (
    <div className="min-w-0 space-y-5 animate-fadein">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Parking operations, access and accountability · DYCI"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canExport}
              onClick={() => download("csv")}
            >
              <Download size={15} /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canExport}
              onClick={() => download("excel")}
            >
              <Download size={15} /> Excel XML
            </Button>
            <Button
              size="sm"
              disabled={!canExport}
              onClick={() => download("print")}
            >
              <Printer size={15} /> Print / PDF
            </Button>
          </div>
        }
      />
      <div className="rounded-xl bg-[#080677] p-4 sm:p-5 text-white">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#D4A72C] font-semibold">
          Admin reporting
        </p>
        <h2 className="text-lg font-semibold mt-1">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-blue-100">
          Choose a report from Reports & Analytics in the sidebar. All dates and
          times use Manila time.
        </p>
      </div>
      {snapshot && (
        <section aria-label="Current campus snapshot">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Current campus snapshot
            </h2>
            <p className="text-xs text-slate-500">
              Campus-wide now · independent of report filters ·{" "}
              {snapshot.status}
            </p>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Total capacity"
              value={snapshot.overall.capacity}
              icon={<ParkingSquare size={17} />}
              sub={`${snapshot.overall.maintenance} under maintenance`}
            />
            <StatCard
              label="Vehicles inside"
              value={snapshot.inside.total}
              icon={<Car size={17} />}
              color="sky"
              sub={`${snapshot.overall.occupied} slots held`}
            />
            <StatCard
              label="Available spaces"
              value={snapshot.overall.available}
              icon={<ParkingSquare size={17} />}
              color="green"
              sub={`${snapshot.overall.occupancy_percent}% recorded occupancy`}
            />
            <StatCard
              label="Today's entries / exits"
              value={`${snapshot.today_entries} / ${snapshot.today_exits}`}
              icon={<Activity size={17} />}
              color="amber"
              sub={`${snapshot.today_denied} denied attempts · ${snapshot.campus_date}`}
            />
          </div>
          {!snapshot.inside.consistent && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"
            >
              Active transactions and assigned slots do not reconcile. Review
              Security & Incidents.
            </p>
          )}
        </section>
      )}
      <Card className="p-4 sm:p-5">
        <form onSubmit={apply}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-slate-700 flex items-center gap-2">
              <SlidersHorizontal size={16} /> Report filters
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["today", "Today"],
                ["yesterday", "Yesterday"],
                ["7", "7 days"],
                ["30", "30 days"],
                ["year", "This year"],
              ].map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => preset(key)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-600 hover:border-[#080677]"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Input
              label="Date from (Manila)"
              aria-label="Date from (Manila)"
              type="date"
              required
              value={draft.date_from}
              onChange={(e) => change("date_from", e.target.value)}
            />
            <Input
              label="Date to (Manila)"
              aria-label="Date to (Manila)"
              type="date"
              required
              value={draft.date_to}
              min={draft.date_from}
              onChange={(e) => change("date_to", e.target.value)}
            />
            {category === "rfid" && (
              <Select
                label="RFID report"
                aria-label="RFID report"
                value={draft.dataset}
                onChange={(e) => change("dataset", e.target.value)}
              >
                <option value="scans">RFID scans</option>
                <option value="assignments">Assignment history</option>
                <option value="devices">Reader & gate inventory</option>
              </Select>
            )}
            {supported.includes("vehicle_type") && (
              <Select
                label="Vehicle type"
                aria-label="Vehicle type"
                value={draft.vehicle_type}
                onChange={(e) => change("vehicle_type", e.target.value)}
              >
                <option value="">All vehicles</option>
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
              </Select>
            )}
            {supported.includes("user_type") && (
              <Select
                label="User type"
                aria-label="User type"
                value={draft.user_type}
                onChange={(e) => change("user_type", e.target.value)}
              >
                <option value="">All users</option>
                {[
                  "student",
                  "faculty",
                  "employee",
                  "security",
                  "admin",
                  "guest",
                  "other",
                ].map((role) => (
                  <option key={role} value={role}>
                    {role === "security"
                      ? "Parking / security staff"
                      : label(role)}
                  </option>
                ))}
              </Select>
            )}
            {supported.includes("status") && (
              <Select
                label="Record status"
                aria-label="Record status"
                value={draft.status}
                onChange={(e) => change("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {reportStatuses(category, draft.dataset).map((status) => (
                  <option key={status} value={status}>
                    {label(status)}
                  </option>
                ))}
              </Select>
            )}
            {supported.includes("area_id") && (
              <Select
                label="Parking area"
                aria-label="Parking area"
                value={draft.area_id}
                onChange={(e) => change("area_id", e.target.value)}
              >
                <option value="">All areas</option>
                {(report?.areas ?? []).map((a) => (
                  <option key={a.parking_area_id} value={a.parking_area_id}>
                    {a.area_name}
                  </option>
                ))}
              </Select>
            )}
            {supported.includes("method") && (
              <Select
                label="Access method"
                aria-label="Access method"
                value={draft.method}
                onChange={(e) => change("method", e.target.value)}
              >
                <option value="">All methods</option>
                <option value="rfid">RFID</option>
                <option value="qr">Visitor QR</option>
                <option value="manual">Manual override</option>
              </Select>
            )}
            {category !== "occupancy" && !(category === "rfid" && draft.dataset === "devices") && (
            <Select
              label="Group charts by"
              aria-label="Group charts by"
              value={draft.group_by}
              onChange={(e) => change("group_by", e.target.value)}
            >
              {["day", "week", "month", "year"].map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </Select>
            )}
            <Select
              label="Sort records"
              aria-label="Sort records"
              value={draft.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="status">Status</option>
              {["overview", "entry-exit"].includes(category) && (
                <option value="duration">Longest completed duration</option>
              )}
            </Select>
            <Select
              label="Rows per page"
              aria-label="Rows per page"
              value={draft.per_page}
              onChange={(e) => change("per_page", e.target.value)}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Input
                label="Search records"
                aria-label="Search records"
                placeholder="Plate, record ID, account, credential or action…"
                maxLength={100}
                value={draft.search}
                onChange={(e) => change("search", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={loading}>
              <SlidersHorizontal size={15} /> Apply filters
            </Button>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={15} /> Refresh
            </Button>
            {dirty && (
              <span role="status" className="text-xs text-amber-700">
                Filters changed. Apply to update the report and enable export.
              </span>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-700 mt-3">
              {formError}
            </p>
          )}
        </form>
      </Card>
      {(error || exportError) && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error || exportError}
          {error && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefresh((v) => v + 1)}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      )}
      {loading && (
        <Card className="p-10 text-center">
          <RefreshCw
            size={22}
            className="mx-auto animate-spin text-[#080677]"
          />
          <p role="status" className="text-sm text-slate-500 mt-3">
            Loading matching PASS records…
          </p>
        </Card>
      )}
      {!loading && report && (
        <>
          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">
              {report.meta.title} · {applied.date_from} to {applied.date_to}
            </p>
            <p>
              Generated {formatCampusDateTime(report.meta.generated_at)} · by{" "}
              {report.meta.generated_by}
            </p>
            <p className="leading-relaxed">{report.meta.date_basis}</p>
          </div>
          <section
            aria-label="Filtered report summary"
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          >
            {report.summary.map((metric, i) => (
              <StatCard
                key={metric.label}
                label={metric.label}
                value={
                  metric.value === null
                    ? "—"
                    : new Intl.NumberFormat("en-PH", {
                        maximumFractionDigits: 2,
                      }).format(metric.value)
                }
                sub={metric.unit}
                icon={i % 2 ? <Clock size={17} /> : <ShieldCheck size={17} />}
                color={i % 2 ? "amber" : "navy"}
              />
            ))}
          </section>
          <ReportCharts
            report={report}
            category={category}
            dataset={applied.dataset}
          />
          <Card>
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="font-semibold text-[#080677]">Report records</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {report.pagination.total} matching records · exports include
                  every matching page
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Open a record for all details
              </span>
            </div>
            {report.data.length ? (
              <Table
                columns={[
                  ...tableColumns,
                  {
                    key: "view",
                    label: "Details",
                    render: (row: ReportRow) => (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(row)}
                      >
                        View <ChevronRight size={14} />
                      </Button>
                    ),
                  },
                ]}
                data={report.data}
                onRowClick={setSelected}
              />
            ) : (
              <div className="p-10 text-center text-sm text-slate-500">
                <Info size={26} className="mx-auto text-slate-300 mb-3" />
                No matching records for these filters.
              </div>
            )}
            <div className="flex flex-wrap justify-between items-center gap-3 px-4 py-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                Page {report.pagination.current_page} of{" "}
                {report.pagination.last_page}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= report.pagination.last_page}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
          <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-600">
              Data definitions & coverage
            </summary>
            <ul className="mt-3 space-y-2 list-disc pl-4 leading-relaxed">
              {report.meta.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
              <li>
                CSV and Excel XML export all matching rows (up to 50,000; larger
                requests must be narrowed). Print / PDF opens the same report
                for printing or saving as PDF.
              </li>
            </ul>
          </details>
        </>
      )}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Report record details"
        size="lg"
      >
        {selected && (
          <dl className="space-y-3">
            {Object.entries(report?.meta.columns ?? {}).map(([key, text]) => (
              <div key={key} className="border-b border-slate-100 pb-3">
                <dt className="text-xs text-slate-400 mb-1">{text}</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                  {display(selected[key], key)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Modal>
    </div>
  )
}
