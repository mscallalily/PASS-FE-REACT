export const REPORT_CATEGORIES = [
  ["overview", "Operations Overview"],
  ["entry-exit", "Vehicle Entry & Exit"],
  ["occupancy", "Parking Occupancy"],
  ["rfid", "RFID & Devices"],
  ["users", "User & Account Records"],
  ["vehicles", "Vehicle & Driver Records"],
  ["visitors", "Visitor & QR Access"],
  ["security", "Security & Incidents"],
  ["audit", "System Activity & Audit"],
] as const
export type ReportCategory = typeof REPORT_CATEGORIES[number][0]
export type ReportFilters = {
  date_from: string
  date_to: string
  vehicle_type: string
  user_type: string
  status: string
  search: string
  area_id: string
  method: string
  dataset: string
  sort: string
  group_by: string
  per_page: string
}
export function filterKeys(category: string, dataset: string): string[] {
  if (["users", "audit"].includes(category))
    return ["search", "user_type", "status"]
  if (category === "rfid")
    return dataset === "devices"
      ? ["search", "status", "area_id"]
      : ["search", "vehicle_type", "user_type", "status"]
  if (["vehicles", "visitors"].includes(category))
    return ["search", "vehicle_type", "user_type", "status"]
  return ["search", "vehicle_type", "user_type", "status", "area_id", "method"]
}
export function reportStatuses(category: string, dataset: string): string[] {
  if (category === "users")
    return ["pending", "active", "suspended", "deactivated"]
  if (category === "vehicles")
    return [
      "pending",
      "approved",
      "rejected",
      "suspended",
      "revoked",
      "expired",
      "not_submitted",
    ]
  if (category === "visitors")
    return [
      "pending",
      "approved",
      "rejected",
      "cancelled",
      "expired",
      "used",
      "revoked",
    ]
  if (category === "rfid")
    return dataset === "devices"
      ? ["online", "offline", "maintenance"]
      : dataset === "assignments"
        ? ["active", "expired", "revoked", "replaced"]
        : ["granted", "denied"]
  if (category === "security")
    return [
      "denied",
      "manual_override",
      "open",
      "under_review",
      "resolved",
      "dismissed",
      "escalated",
      "integrity_warning",
    ]
  if (category === "audit") return ["recorded"]
  return ["active", "completed", "force_closed", "cancelled"]
}
export function campusDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
export function defaultFilters(): ReportFilters {
  return {
    date_from: campusDate(),
    date_to: campusDate(),
    vehicle_type: "",
    user_type: "",
    status: "",
    search: "",
    area_id: "",
    method: "",
    dataset: "scans",
    sort: "newest",
    group_by: "day",
    per_page: "25",
  }
}
export function reportQuery(
  category: string,
  filters: ReportFilters,
): URLSearchParams {
  const allowed = [
    ...filterKeys(category, filters.dataset),
    "date_from",
    "date_to",
    "dataset",
    "sort",
    "group_by",
    "per_page",
  ]
  const params = new URLSearchParams({ category })
  for (const [key, value] of Object.entries(filters))
    if (value && allowed.includes(key)) params.set(key, value)
  return params
}
