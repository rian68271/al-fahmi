import { supabase } from "@/lib/supabase";

export interface SettingsRecord {
  id?: string;
  school_lat: number;
  school_lng: number;
  max_radius: number;
}

export interface CalendarEventRecord {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  type: string;
  status: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface ProfileRecord {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  class_id: string | null;
  kelas: string | null;
  sekolah: string | null;
}

export interface TeacherStudentAssignmentRecord {
  id: string;
  teacher_id: string;
  student_id: string;
}

export interface QuranAssessmentRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  category: string;
  juz_jilid: string | null;
  surah: string | null;
  ayat_dari: string | null;
  ayat_sampai: string | null;
  halaman: string | null;
  nilai: number;
  catatan: string | null;
  kehadiran_siswa: string | null;
  date: string;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  link_href: string | null;
  role_target: string | null;
  recipient_id: string | null;
  created_at: string;
}

export async function fetchSettings() {
  return supabase.from("settings").select("id, school_lat, school_lng, max_radius").limit(1).maybeSingle();
}

export async function upsertSettings(payload: SettingsRecord) {
  return supabase.from("settings").upsert(payload).select("id, school_lat, school_lng, max_radius").single();
}

export async function fetchCalendarEvents() {
  return supabase.from("calendar_events").select("id, title, description, event_date").order("event_date", { ascending: true });
}

export async function createCalendarEvent(payload: Omit<CalendarEventRecord, "id">) {
  return supabase.from("calendar_events").insert(payload).select("id, title, description, event_date").single();
}

export async function updateCalendarEvent(id: string, payload: Omit<CalendarEventRecord, "id">) {
  return supabase.from("calendar_events").update(payload).eq("id", id).select("id, title, description, event_date").single();
}

export async function deleteCalendarEvent(id: string) {
  return supabase.from("calendar_events").delete().eq("id", id);
}

export async function fetchAttendanceHistory(userId: string) {
  return supabase.from("attendances").select("id, user_id, type, status, lat, lng, created_at").eq("user_id", userId).order("created_at", { ascending: false });
}

export async function fetchAttendances(filters?: { userId?: string; fromDate?: string; toDate?: string }) {
  let query = supabase.from("attendances").select("id, user_id, type, status, lat, lng, created_at").order("created_at", { ascending: false });

  if (filters?.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters?.fromDate) {
    query = query.gte("created_at", filters.fromDate);
  }

  if (filters?.toDate) {
    query = query.lte("created_at", filters.toDate);
  }

  return query;
}

export async function createAttendance(payload: { user_id: string; type: string; status: string; lat?: number; lng?: number }) {
  return supabase
    .from("attendances")
    .insert({
      user_id: payload.user_id,
      type: payload.type,
      status: payload.status,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
    })
    .select("id, user_id, type, status, lat, lng, created_at")
    .single();
}

export async function fetchProfilesByRole(role: "admin" | "guru" | "siswa") {
  return supabase.from("profiles").select("id, name, email, role, class_id, kelas, sekolah").eq("role", role).order("name", { ascending: true });
}

export async function fetchStudentsByClass(kelas?: string) {
  let query = supabase.from("profiles").select("id, name, email, role, class_id, kelas, sekolah").eq("role", "siswa").order("name", { ascending: true });

  if (kelas && kelas !== "Semua Kelas") {
    query = query.eq("kelas", kelas);
  }

  return query;
}

export async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) {
    return { data: [] as ProfileRecord[], error: null };
  }

  return supabase.from("profiles").select("id, name, email, role, class_id, kelas, sekolah").in("id", ids);
}

export async function fetchAssignments() {
  return supabase.from("teacher_student_assignments").select("id, teacher_id, student_id").order("id", { ascending: false });
}

export async function fetchAssignmentsByTeacher(teacherId: string) {
  return supabase.from("teacher_student_assignments").select("id, teacher_id, student_id").eq("teacher_id", teacherId).order("id", { ascending: false });
}

export async function createAssignment(payload: { teacher_id: string; student_id: string }) {
  return supabase.from("teacher_student_assignments").insert(payload).select("id, teacher_id, student_id").single();
}

export async function deleteAssignment(id: string) {
  return supabase.from("teacher_student_assignments").delete().eq("id", id);
}

export async function fetchQuranAssessments(filters?: { studentId?: string; teacherId?: string; kelas?: string; fromMonth?: string }) {
  let query = supabase.from("quran_assessments").select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date").order("date", { ascending: false });

  if (filters?.studentId) {
    query = query.eq("student_id", filters.studentId);
  }

  if (filters?.teacherId) {
    query = query.eq("teacher_id", filters.teacherId);
  }

  if (filters?.fromMonth) {
    const { startDate, nextMonthStartDate } = getMonthDateRange(filters.fromMonth);
    query = query.gte("date", startDate).lt("date", nextMonthStartDate);
  }

  return query;
}

export async function createQuranAssessment(payload: {
  student_id: string;
  teacher_id: string;
  category: string;
  juz_jilid: string;
  surah?: string | null;
  ayat_dari?: string | null;
  ayat_sampai?: string | null;
  halaman?: string | null;
  nilai: number;
  catatan?: string | null;
  kehadiran_siswa?: string | null;
  date: string;
}) {
  return supabase.from("quran_assessments").insert(payload).select("id, student_id, teacher_id, category, juz_jilid, surah, ayat_dari, ayat_sampai, halaman, nilai, catatan, kehadiran_siswa, date").single();
}

export async function fetchNotifications(filters?: { role?: string; recipientId?: string; limit?: number }) {
  const result = await supabase
    .from("notifications")
    .select("id, title, body, type, link_href, role_target, recipient_id, created_at")
    .order("created_at", { ascending: false });

  if (result.error) {
    return result;
  }

  let data = result.data ?? [];

  if (filters?.recipientId) {
    data = data.filter((item) => item.recipient_id === null || item.recipient_id === filters.recipientId);
  }

  if (filters?.role) {
    data = data.filter((item) => item.role_target === null || item.role_target === filters.role);
  }

  if (filters?.limit) {
    data = data.slice(0, filters.limit);
  }

  return {
    data,
    error: null,
  };
}

export type TeacherEmploymentStatus = "tetap" | "honorer" | "kontrak" | "magang" | "nonaktif";
export type StudentStatus = "aktif" | "cuti" | "lulus" | "pindah" | "nonaktif";

export interface TeacherRecord {
  id: string;
  profile_id: string | null;
  nip: string;
  full_name: string;
  subjects: string[];
  education_history: string[];
  employment_status: TeacherEmploymentStatus;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherPayload {
  profile_id?: string | null;
  nip: string;
  full_name: string;
  subjects: string[];
  education_history: string[];
  employment_status: TeacherEmploymentStatus;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  notes?: string | null;
}

export interface GuardianInfo {
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  relationship?: string;
  phone?: string;
  occupation?: string;
}

export interface StudentRecord {
  id: string;
  profile_id: string | null;
  nis: string;
  full_name: string;
  class_name: string;
  major: string;
  student_status: StudentStatus;
  guardian_info: GuardianInfo;
  address: string;
  phone: string | null;
  academic_history: string[];
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentPayload {
  profile_id?: string | null;
  nis: string;
  full_name: string;
  class_name: string;
  major: string;
  student_status: StudentStatus;
  guardian_info: GuardianInfo;
  address: string;
  phone?: string | null;
  academic_history: string[];
  photo_url?: string | null;
  notes?: string | null;
}

export interface ActivityLogRecord {
  id: string;
  actor_id: string | null;
  module_name: "teachers" | "students" | "system";
  entity_id: string | null;
  entity_label: string | null;
  action: "create" | "update" | "delete" | "export" | "import" | "backup" | "upload";
  description: string;
  metadata: Record<string, unknown>;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface StudentBackupRecord {
  id: string;
  student_id: string | null;
  backup_type: "insert" | "update" | "delete";
  snapshot: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

const teacherSelectColumns =
  "id, profile_id, nip, full_name, subjects, education_history, employment_status, contact_phone, contact_email, contact_address, notes, created_at, updated_at";

const studentSelectColumns =
  "id, profile_id, nis, full_name, class_name, major, student_status, guardian_info, address, phone, academic_history, photo_url, notes, created_at, updated_at";

const activityLogSelectColumns =
  "id, actor_id, module_name, entity_id, entity_label, action, description, metadata, before_data, after_data, created_at";

const studentBackupSelectColumns = "id, student_id, backup_type, snapshot, actor_id, created_at";

const getMonthDateRange = (monthValue: string) => {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const startDate = `${yearText}-${monthText}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const nextYearText = String(nextMonth.getUTCFullYear());
  const nextMonthText = String(nextMonth.getUTCMonth() + 1).padStart(2, "0");
  const nextMonthStartDate = `${nextYearText}-${nextMonthText}-01`;

  return {
    startDate,
    nextMonthStartDate,
  };
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
};

const normalizeGuardianInfo = (value: unknown): GuardianInfo => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const guardian = value as Record<string, unknown>;

  return {
    fatherName: typeof guardian.fatherName === "string" ? guardian.fatherName : "",
    motherName: typeof guardian.motherName === "string" ? guardian.motherName : "",
    guardianName: typeof guardian.guardianName === "string" ? guardian.guardianName : "",
    relationship: typeof guardian.relationship === "string" ? guardian.relationship : "",
    phone: typeof guardian.phone === "string" ? guardian.phone : "",
    occupation: typeof guardian.occupation === "string" ? guardian.occupation : "",
  };
};

const mapTeacherRecord = (item: Record<string, unknown>): TeacherRecord => ({
  id: String(item.id),
  profile_id: item.profile_id ? String(item.profile_id) : null,
  nip: String(item.nip ?? ""),
  full_name: String(item.full_name ?? ""),
  subjects: normalizeStringArray(item.subjects),
  education_history: normalizeStringArray(item.education_history),
  employment_status: String(item.employment_status ?? "tetap") as TeacherEmploymentStatus,
  contact_phone: item.contact_phone ? String(item.contact_phone) : null,
  contact_email: item.contact_email ? String(item.contact_email) : null,
  contact_address: item.contact_address ? String(item.contact_address) : null,
  notes: item.notes ? String(item.notes) : null,
  created_at: String(item.created_at ?? ""),
  updated_at: String(item.updated_at ?? ""),
});

const mapStudentRecord = (item: Record<string, unknown>): StudentRecord => ({
  id: String(item.id),
  profile_id: item.profile_id ? String(item.profile_id) : null,
  nis: String(item.nis ?? ""),
  full_name: String(item.full_name ?? ""),
  class_name: String(item.class_name ?? ""),
  major: String(item.major ?? ""),
  student_status: String(item.student_status ?? "aktif") as StudentStatus,
  guardian_info: normalizeGuardianInfo(item.guardian_info),
  address: String(item.address ?? ""),
  phone: item.phone ? String(item.phone) : null,
  academic_history: normalizeStringArray(item.academic_history),
  photo_url: item.photo_url ? String(item.photo_url) : null,
  notes: item.notes ? String(item.notes) : null,
  created_at: String(item.created_at ?? ""),
  updated_at: String(item.updated_at ?? ""),
});

const mapActivityLogRecord = (item: Record<string, unknown>): ActivityLogRecord => ({
  id: String(item.id),
  actor_id: item.actor_id ? String(item.actor_id) : null,
  module_name: String(item.module_name ?? "system") as ActivityLogRecord["module_name"],
  entity_id: item.entity_id ? String(item.entity_id) : null,
  entity_label: item.entity_label ? String(item.entity_label) : null,
  action: String(item.action ?? "create") as ActivityLogRecord["action"],
  description: String(item.description ?? ""),
  metadata: item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? (item.metadata as Record<string, unknown>) : {},
  before_data: item.before_data && typeof item.before_data === "object" && !Array.isArray(item.before_data) ? (item.before_data as Record<string, unknown>) : null,
  after_data: item.after_data && typeof item.after_data === "object" && !Array.isArray(item.after_data) ? (item.after_data as Record<string, unknown>) : null,
  created_at: String(item.created_at ?? ""),
});

const mapStudentBackupRecord = (item: Record<string, unknown>): StudentBackupRecord => ({
  id: String(item.id),
  student_id: item.student_id ? String(item.student_id) : null,
  backup_type: String(item.backup_type ?? "insert") as StudentBackupRecord["backup_type"],
  snapshot: item.snapshot && typeof item.snapshot === "object" && !Array.isArray(item.snapshot) ? (item.snapshot as Record<string, unknown>) : {},
  actor_id: item.actor_id ? String(item.actor_id) : null,
  created_at: String(item.created_at ?? ""),
});

export async function fetchTeachers(filters?: { search?: string; subject?: string; status?: TeacherEmploymentStatus | "Semua Status" }) {
  let query = supabase.from("teachers").select(teacherSelectColumns).order("updated_at", { ascending: false });

  if (filters?.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`full_name.ilike.%${search}%,nip.ilike.%${search}%,contact_email.ilike.%${search}%,contact_phone.ilike.%${search}%`);
  }

  if (filters?.status && filters.status !== "Semua Status") {
    query = query.eq("employment_status", filters.status);
  }

  if (filters?.subject && filters.subject !== "Semua Mapel") {
    query = query.contains("subjects", [filters.subject]);
  }

  const result = await query;

  return {
    data: (result.data ?? []).map((item) => mapTeacherRecord(item as Record<string, unknown>)),
    error: result.error,
  };
}

export async function createTeacher(payload: TeacherPayload) {
  const result = await supabase.from("teachers").insert(payload).select(teacherSelectColumns).single();

  return {
    data: result.data ? mapTeacherRecord(result.data as Record<string, unknown>) : null,
    error: result.error,
  };
}

export async function updateTeacher(id: string, payload: TeacherPayload) {
  const result = await supabase.from("teachers").update(payload).eq("id", id).select(teacherSelectColumns).single();

  return {
    data: result.data ? mapTeacherRecord(result.data as Record<string, unknown>) : null,
    error: result.error,
  };
}

export async function deleteTeacher(id: string) {
  return supabase.from("teachers").delete().eq("id", id);
}

export async function fetchStudents(filters?: {
  search?: string;
  className?: string;
  major?: string;
  status?: StudentStatus | "Semua Status";
}) {
  let query = supabase.from("students").select(studentSelectColumns).order("updated_at", { ascending: false });

  if (filters?.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`full_name.ilike.%${search}%,nis.ilike.%${search}%,class_name.ilike.%${search}%,major.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  if (filters?.className && filters.className !== "Semua Kelas") {
    query = query.eq("class_name", filters.className);
  }

  if (filters?.major && filters.major !== "Semua Jurusan") {
    query = query.eq("major", filters.major);
  }

  if (filters?.status && filters.status !== "Semua Status") {
    query = query.eq("student_status", filters.status);
  }

  const result = await query;

  return {
    data: (result.data ?? []).map((item) => mapStudentRecord(item as Record<string, unknown>)),
    error: result.error,
  };
}

export async function createStudent(payload: StudentPayload) {
  const result = await supabase.from("students").insert(payload).select(studentSelectColumns).single();

  return {
    data: result.data ? mapStudentRecord(result.data as Record<string, unknown>) : null,
    error: result.error,
  };
}

export async function updateStudent(id: string, payload: StudentPayload) {
  const result = await supabase.from("students").update(payload).eq("id", id).select(studentSelectColumns).single();

  return {
    data: result.data ? mapStudentRecord(result.data as Record<string, unknown>) : null,
    error: result.error,
  };
}

export async function deleteStudent(id: string) {
  return supabase.from("students").delete().eq("id", id);
}

export async function fetchActivityLogs(filters?: { moduleName?: ActivityLogRecord["module_name"] | "all"; limit?: number }) {
  let query = supabase.from("activity_logs").select(activityLogSelectColumns).order("created_at", { ascending: false });

  if (filters?.moduleName && filters.moduleName !== "all") {
    query = query.eq("module_name", filters.moduleName);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const result = await query;

  return {
    data: (result.data ?? []).map((item) => mapActivityLogRecord(item as Record<string, unknown>)),
    error: result.error,
  };
}

export async function fetchStudentBackups(filters?: { studentId?: string; limit?: number }) {
  let query = supabase.from("student_backups").select(studentBackupSelectColumns).order("created_at", { ascending: false });

  if (filters?.studentId) {
    query = query.eq("student_id", filters.studentId);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const result = await query;

  return {
    data: (result.data ?? []).map((item) => mapStudentBackupRecord(item as Record<string, unknown>)),
    error: result.error,
  };
}

export async function createActivityLog(payload: {
  module_name: ActivityLogRecord["module_name"];
  action: ActivityLogRecord["action"];
  description: string;
  entity_id?: string | null;
  entity_label?: string | null;
  metadata?: Record<string, unknown>;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
}) {
  const result = await supabase
    .from("activity_logs")
    .insert({
      module_name: payload.module_name,
      action: payload.action,
      description: payload.description,
      entity_id: payload.entity_id ?? null,
      entity_label: payload.entity_label ?? null,
      metadata: payload.metadata ?? {},
      before_data: payload.before_data ?? null,
      after_data: payload.after_data ?? null,
    })
    .select(activityLogSelectColumns)
    .single();

  return {
    data: result.data ? mapActivityLogRecord(result.data as Record<string, unknown>) : null,
    error: result.error,
  };
}

export async function uploadStudentPhoto(file: File, studentId: string) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
  const filePath = `${studentId}/${Date.now()}-${sanitizedName || `photo.${extension}`}`;

  const uploadResult = await supabase.storage.from("student-photos").upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (uploadResult.error) {
    return {
      data: null,
      error: uploadResult.error,
    };
  }

  const { data } = supabase.storage.from("student-photos").getPublicUrl(filePath);

  return {
    data: {
      path: filePath,
      publicUrl: data.publicUrl,
    },
    error: null,
  };
}
