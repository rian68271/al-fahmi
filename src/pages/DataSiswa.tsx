import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Filter, GraduationCap, History, ImagePlus, Pencil, RefreshCw, Save, Search, ShieldCheck, Trash2, Upload, UserRoundCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/store/auth";
import {
  createActivityLog,
  createStudent,
  createTeacher,
  deleteStudent,
  deleteTeacher,
  fetchActivityLogs,
  fetchProfilesByIds,
  fetchStudentBackups,
  fetchStudents,
  fetchTeachers,
  type ActivityLogRecord,
  type GuardianInfo,
  type StudentPayload,
  type StudentRecord,
  type StudentStatus,
  type TeacherEmploymentStatus,
  type TeacherPayload,
  type TeacherRecord,
  type StudentBackupRecord,
  updateStudent,
  updateTeacher,
  uploadStudentPhoto,
} from "@/lib/supabase-data";

type TabKey = "guru" | "siswa" | "audit";
type MessageState = { type: "success" | "error" | "info"; text: string } | null;
type LogFilter = "all" | ActivityLogRecord["module_name"];

interface TeacherFormState {
  nip: string;
  fullName: string;
  subjects: string;
  educationHistory: string;
  employmentStatus: TeacherEmploymentStatus;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  notes: string;
}

interface StudentFormState {
  nis: string;
  fullName: string;
  className: string;
  major: string;
  studentStatus: StudentStatus;
  fatherName: string;
  motherName: string;
  guardianName: string;
  relationship: string;
  guardianPhone: string;
  occupation: string;
  address: string;
  phone: string;
  academicHistory: string;
  notes: string;
}

const selectClassName =
  "flex h-11 w-full rounded-2xl border border-input bg-white/90 px-4 py-2.5 text-sm shadow-sm ring-offset-background focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/10";

const teacherStatusOptions: Array<TeacherEmploymentStatus | "Semua Status"> = ["Semua Status", "tetap", "honorer", "kontrak", "magang", "nonaktif"];
const studentStatusOptions: Array<StudentStatus | "Semua Status"> = ["Semua Status", "aktif", "cuti", "lulus", "pindah", "nonaktif"];

const initialTeacherForm = (): TeacherFormState => ({
  nip: "",
  fullName: "",
  subjects: "",
  educationHistory: "",
  employmentStatus: "tetap",
  contactPhone: "",
  contactEmail: "",
  contactAddress: "",
  notes: "",
});

const initialStudentForm = (): StudentFormState => ({
  nis: "",
  fullName: "",
  className: "",
  major: "",
  studentStatus: "aktif",
  fatherName: "",
  motherName: "",
  guardianName: "",
  relationship: "",
  guardianPhone: "",
  occupation: "",
  address: "",
  phone: "",
  academicHistory: "",
  notes: "",
});

const splitMultilineValue = (value: string) =>
  value
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinMultilineValue = (value: string[]) => value.join("\n");

const formatDateTime = (value: string) => (value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-");

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const normalizeSpreadsheetKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizeSpreadsheetRow = (row: Record<string, unknown>) => {
  const normalized: Record<string, string> = {};

  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeSpreadsheetKey(key)] = String(value ?? "").trim();
  });

  return normalized;
};

const getSpreadsheetValue = (row: Record<string, string>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[normalizeSpreadsheetKey(alias)];
    if (value) {
      return value;
    }
  }

  return "";
};

const normalizeStudentStatus = (value: string): StudentStatus => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "cuti" || normalized === "lulus" || normalized === "pindah" || normalized === "nonaktif") {
    return normalized;
  }
  return "aktif";
};

const validateTeacherForm = (form: TeacherFormState, teachers: TeacherRecord[], editingId: string | null) => {
  const errors: string[] = [];
  const hasDuplicateNip = teachers.some((teacher) => teacher.nip === form.nip.trim() && teacher.id !== editingId);

  if (form.nip.trim().length < 8) errors.push("NIP minimal 8 karakter.");
  if (form.fullName.trim().length < 3) errors.push("Nama guru minimal 3 karakter.");
  if (splitMultilineValue(form.subjects).length === 0) errors.push("Minimal isi satu mata pelajaran.");
  if (splitMultilineValue(form.educationHistory).length === 0) errors.push("Riwayat pendidikan wajib diisi.");
  if (hasDuplicateNip) errors.push("NIP sudah digunakan pada data guru lain.");
  if (form.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) errors.push("Format email guru tidak valid.");

  return errors;
};

const validateStudentForm = (form: StudentFormState, students: StudentRecord[], editingId: string | null) => {
  const errors: string[] = [];
  const hasDuplicateNis = students.some((student) => student.nis === form.nis.trim() && student.id !== editingId);

  if (form.nis.trim().length < 5) errors.push("NIS minimal 5 karakter.");
  if (form.fullName.trim().length < 3) errors.push("Nama siswa minimal 3 karakter.");
  if (!form.className.trim()) errors.push("Kelas wajib diisi.");
  if (form.major.trim().length < 2) errors.push("Jurusan wajib diisi minimal 2 karakter.");
  if (!form.address.trim()) errors.push("Alamat lengkap wajib diisi.");
  if (splitMultilineValue(form.academicHistory).length === 0) errors.push("Riwayat akademik wajib diisi.");
  if (hasDuplicateNis) errors.push("NIS sudah digunakan pada data siswa lain.");

  return errors;
};

const buildTeacherPayload = (form: TeacherFormState): TeacherPayload => ({
  nip: form.nip.trim(),
  full_name: form.fullName.trim(),
  subjects: splitMultilineValue(form.subjects),
  education_history: splitMultilineValue(form.educationHistory),
  employment_status: form.employmentStatus,
  contact_phone: form.contactPhone.trim() || null,
  contact_email: form.contactEmail.trim() || null,
  contact_address: form.contactAddress.trim() || null,
  notes: form.notes.trim() || null,
});

const buildStudentPayload = (form: StudentFormState, photoUrl?: string | null): StudentPayload => {
  const guardianInfo: GuardianInfo = {
    fatherName: form.fatherName.trim(),
    motherName: form.motherName.trim(),
    guardianName: form.guardianName.trim(),
    relationship: form.relationship.trim(),
    phone: form.guardianPhone.trim(),
    occupation: form.occupation.trim(),
  };

  return {
    nis: form.nis.trim(),
    full_name: form.fullName.trim(),
    class_name: form.className.trim(),
    major: form.major.trim(),
    student_status: form.studentStatus,
    guardian_info: guardianInfo,
    address: form.address.trim(),
    phone: form.phone.trim() || null,
    academic_history: splitMultilineValue(form.academicHistory),
    photo_url: photoUrl ?? null,
    notes: form.notes.trim() || null,
  };
};

const createTeacherExportRows = (teachers: TeacherRecord[]) =>
  teachers.map((teacher, index) => ({
    No: index + 1,
    NIP: teacher.nip,
    Nama_Lengkap: teacher.full_name,
    Mata_Pelajaran: teacher.subjects.join(", "),
    Riwayat_Pendidikan: teacher.education_history.join(" | "),
    Status_Kepegawaian: teacher.employment_status,
    Telepon: teacher.contact_phone ?? "-",
    Email: teacher.contact_email ?? "-",
    Kontak_Alamat: teacher.contact_address ?? "-",
    Diperbarui: formatDateTime(teacher.updated_at),
  }));

const createStudentExportRows = (students: StudentRecord[]) =>
  students.map((student, index) => ({
    No: index + 1,
    NIS: student.nis,
    Nama_Lengkap: student.full_name,
    Kelas: student.class_name,
    Jurusan: student.major,
    Status: student.student_status,
    Orang_Tua_Wali: [student.guardian_info.fatherName, student.guardian_info.motherName, student.guardian_info.guardianName].filter(Boolean).join(" / ") || "-",
    Hubungan: student.guardian_info.relationship || "-",
    Telepon_Orang_Tua: student.guardian_info.phone || "-",
    Telepon_Siswa: student.phone ?? "-",
    Alamat: student.address,
    Riwayat_Akademik: student.academic_history.join(" | "),
    Foto: student.photo_url ?? "-",
    Diperbarui: formatDateTime(student.updated_at),
  }));

const loadXlsx = () => import("xlsx");

const downloadWorkbook = async (sheetName: string, filename: string, rows: Record<string, string | number>[]) => {
  const XLSX = await loadXlsx();
  const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: "Tidak ada data untuk diekspor." }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
};

const openPrintableReport = (title: string, headers: string[], rows: string[][]) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!printWindow) {
    return false;
  }

  const tableHeader = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tableRows = rows.length > 0 ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Tidak ada data untuk ditampilkan.</td></tr>`;

  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1 { margin-bottom: 8px; color: #000080; }
          p { margin-bottom: 24px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
          th { background: #eef0ff; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>Dicetak pada ${escapeHtml(new Date().toLocaleString("id-ID"))}</p>
        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();

  return true;
};

function StatusBadge({ value }: { value: string }) {
  const tone = value === "aktif" || value === "tetap" ? "bg-emerald-100 text-emerald-700" : value === "honorer" || value === "kontrak" || value === "magang" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}>{value}</span>;
}

export function DataSiswa() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>("guru");
  const [message, setMessage] = useState<MessageState>(null);

  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [studentBackups, setStudentBackups] = useState<StudentBackupRecord[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const [teacherFilters, setTeacherFilters] = useState({
    search: "",
    subject: "Semua Mapel",
    status: "Semua Status" as TeacherEmploymentStatus | "Semua Status",
  });
  const [studentFilters, setStudentFilters] = useState({
    search: "",
    className: "Semua Kelas",
    major: "Semua Jurusan",
    status: "Semua Status" as StudentStatus | "Semua Status",
  });
  const [logFilter, setLogFilter] = useState<LogFilter>("all");

  const [teacherForm, setTeacherForm] = useState<TeacherFormState>(initialTeacherForm);
  const [studentForm, setStudentForm] = useState<StudentFormState>(initialStudentForm);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [existingStudentPhotoUrl, setExistingStudentPhotoUrl] = useState<string | null>(null);

  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [savingStudent, setSavingStudent] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);

  const subjectOptions = useMemo(() => ["Semua Mapel", ...Array.from(new Set(teachers.flatMap((teacher) => teacher.subjects))).sort((a, b) => a.localeCompare(b, "id-ID"))], [teachers]);
  const classOptions = useMemo(() => ["Semua Kelas", ...Array.from(new Set(students.map((student) => student.class_name))).sort((a, b) => a.localeCompare(b, "id-ID"))], [students]);
  const majorOptions = useMemo(() => ["Semua Jurusan", ...Array.from(new Set(students.map((student) => student.major))).sort((a, b) => a.localeCompare(b, "id-ID"))], [students]);

  const activeTeacherCount = useMemo(() => teachers.filter((teacher) => teacher.employment_status !== "nonaktif").length, [teachers]);
  const activeStudentCount = useMemo(() => students.filter((student) => student.student_status === "aktif").length, [students]);

  const loadTeacherData = useCallback(async () => {
    setLoadingTeachers(true);
    const { data, error } = await fetchTeachers(teacherFilters);

    if (error) {
      setMessage({ type: "error", text: `Gagal memuat data guru: ${error.message}` });
      setLoadingTeachers(false);
      return;
    }

    setTeachers(data ?? []);
    setLoadingTeachers(false);
  }, [teacherFilters]);

  const loadStudentData = useCallback(async () => {
    setLoadingStudents(true);
    const { data, error } = await fetchStudents(studentFilters);

    if (error) {
      setMessage({ type: "error", text: `Gagal memuat data siswa: ${error.message}` });
      setLoadingStudents(false);
      return;
    }

    setStudents(data ?? []);
    setLoadingStudents(false);
  }, [studentFilters]);

  const loadAuditData = useCallback(async () => {
    setLoadingAudit(true);
    const [logsResult, backupsResult] = await Promise.all([fetchActivityLogs({ moduleName: logFilter, limit: 18 }), fetchStudentBackups({ limit: 12 })]);

    if (logsResult.error || backupsResult.error) {
      setMessage({ type: "error", text: "Gagal memuat audit trail atau backup otomatis." });
      setLoadingAudit(false);
      return;
    }

    const logs = logsResult.data ?? [];
    const actorIds = Array.from(new Set(logs.map((item) => item.actor_id).filter(Boolean))) as string[];
    const profilesResult = actorIds.length > 0 ? await fetchProfilesByIds(actorIds) : { data: [], error: null };
    const namesMap = Object.fromEntries((profilesResult.data ?? []).map((profile) => [profile.id, profile.name ?? profile.email ?? profile.id]));

    setActivityLogs(logs);
    setStudentBackups(backupsResult.data ?? []);
    setActorNames(namesMap);
    setLoadingAudit(false);
  }, [logFilter]);

  useEffect(() => {
    void loadTeacherData();
  }, [loadTeacherData]);

  useEffect(() => {
    void loadStudentData();
  }, [loadStudentData]);

  useEffect(() => {
    void loadAuditData();
  }, [loadAuditData]);

  const resetTeacherForm = () => {
    setTeacherForm(initialTeacherForm());
    setEditingTeacherId(null);
  };

  const resetStudentForm = () => {
    setStudentForm(initialStudentForm());
    setEditingStudentId(null);
    setStudentPhotoFile(null);
    setExistingStudentPhotoUrl(null);
  };

  const handleTeacherSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateTeacherForm(teacherForm, teachers, editingTeacherId);

    if (errors.length > 0) {
      setMessage({ type: "error", text: errors.join(" ") });
      return;
    }

    setSavingTeacher(true);
    const payload = buildTeacherPayload(teacherForm);
    const result = editingTeacherId ? await updateTeacher(editingTeacherId, payload) : await createTeacher(payload);

    if (result.error) {
      setMessage({ type: "error", text: `Gagal menyimpan data guru: ${result.error.message}` });
      setSavingTeacher(false);
      return;
    }

    await Promise.all([loadTeacherData(), loadAuditData()]);
    resetTeacherForm();
    setMessage({ type: "success", text: editingTeacherId ? "Data guru berhasil diperbarui." : "Data guru berhasil ditambahkan." });
    setSavingTeacher(false);
  };

  const handleTeacherEdit = (teacher: TeacherRecord) => {
    setActiveTab("guru");
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      nip: teacher.nip,
      fullName: teacher.full_name,
      subjects: joinMultilineValue(teacher.subjects),
      educationHistory: joinMultilineValue(teacher.education_history),
      employmentStatus: teacher.employment_status,
      contactPhone: teacher.contact_phone ?? "",
      contactEmail: teacher.contact_email ?? "",
      contactAddress: teacher.contact_address ?? "",
      notes: teacher.notes ?? "",
    });
  };

  const handleTeacherDelete = async (teacher: TeacherRecord) => {
    if (!window.confirm(`Hapus data guru ${teacher.full_name}?`)) {
      return;
    }

    const { error } = await deleteTeacher(teacher.id);

    if (error) {
      setMessage({ type: "error", text: `Gagal menghapus data guru: ${error.message}` });
      return;
    }

    if (editingTeacherId === teacher.id) {
      resetTeacherForm();
    }

    await Promise.all([loadTeacherData(), loadAuditData()]);
    setMessage({ type: "success", text: "Data guru berhasil dihapus." });
  };

  const handleStudentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validateStudentForm(studentForm, students, editingStudentId);

    if (errors.length > 0) {
      setMessage({ type: "error", text: errors.join(" ") });
      return;
    }

    setSavingStudent(true);
    let workingPhotoUrl = existingStudentPhotoUrl;
    const basePayload = buildStudentPayload(studentForm, workingPhotoUrl);
    const mutationResult = editingStudentId ? await updateStudent(editingStudentId, basePayload) : await createStudent(basePayload);

    if (mutationResult.error || !mutationResult.data) {
      setMessage({ type: "error", text: `Gagal menyimpan data siswa: ${mutationResult.error?.message ?? "Data tidak kembali dari server."}` });
      setSavingStudent(false);
      return;
    }

    let savedStudent = mutationResult.data;

    if (studentPhotoFile) {
      const uploadResult = await uploadStudentPhoto(studentPhotoFile, savedStudent.id);

      if (uploadResult.error || !uploadResult.data) {
        setMessage({ type: "error", text: `Data siswa tersimpan, tetapi unggah foto gagal: ${uploadResult.error?.message ?? "Unknown error"}` });
        setSavingStudent(false);
        await Promise.all([loadStudentData(), loadAuditData()]);
        return;
      }

      workingPhotoUrl = uploadResult.data.publicUrl;
      const updatePhotoResult = await updateStudent(savedStudent.id, buildStudentPayload(studentForm, workingPhotoUrl));

      if (updatePhotoResult.error || !updatePhotoResult.data) {
        setMessage({ type: "error", text: `Foto berhasil diunggah, tetapi tautan foto gagal disimpan: ${updatePhotoResult.error?.message ?? "Unknown error"}` });
        setSavingStudent(false);
        await Promise.all([loadStudentData(), loadAuditData()]);
        return;
      }

      savedStudent = updatePhotoResult.data;
      await createActivityLog({
        module_name: "students",
        action: "upload",
        entity_id: savedStudent.id,
        entity_label: savedStudent.full_name,
        description: `Mengunggah foto profil untuk siswa ${savedStudent.full_name}.`,
        metadata: { photo_url: workingPhotoUrl },
      });
    }

    await Promise.all([loadStudentData(), loadAuditData()]);
    resetStudentForm();
    setMessage({ type: "success", text: editingStudentId ? "Data siswa berhasil diperbarui." : "Data siswa berhasil ditambahkan." });
    setSavingStudent(false);
  };

  const handleStudentEdit = (student: StudentRecord) => {
    setActiveTab("siswa");
    setEditingStudentId(student.id);
    setExistingStudentPhotoUrl(student.photo_url);
    setStudentPhotoFile(null);
    setStudentForm({
      nis: student.nis,
      fullName: student.full_name,
      className: student.class_name,
      major: student.major,
      studentStatus: student.student_status,
      fatherName: student.guardian_info.fatherName ?? "",
      motherName: student.guardian_info.motherName ?? "",
      guardianName: student.guardian_info.guardianName ?? "",
      relationship: student.guardian_info.relationship ?? "",
      guardianPhone: student.guardian_info.phone ?? "",
      occupation: student.guardian_info.occupation ?? "",
      address: student.address,
      phone: student.phone ?? "",
      academicHistory: joinMultilineValue(student.academic_history),
      notes: student.notes ?? "",
    });
  };

  const handleStudentDelete = async (student: StudentRecord) => {
    if (!window.confirm(`Hapus data siswa ${student.full_name}?`)) {
      return;
    }

    const { error } = await deleteStudent(student.id);

    if (error) {
      setMessage({ type: "error", text: `Gagal menghapus data siswa: ${error.message}` });
      return;
    }

    if (editingStudentId === student.id) {
      resetStudentForm();
    }

    await Promise.all([loadStudentData(), loadAuditData()]);
    setMessage({ type: "success", text: "Data siswa berhasil dihapus dan backup otomatis tercatat." });
  };

  const handleTeacherExportExcel = async () => {
    await downloadWorkbook("Data Guru", "Data_Guru_Al-Fahmi.xlsx", createTeacherExportRows(teachers));
    await createActivityLog({
      module_name: "teachers",
      action: "export",
      description: `Mengekspor ${teachers.length} data guru ke Excel.`,
      metadata: { format: "xlsx", total: teachers.length },
    });
    await loadAuditData();
    setMessage({ type: "success", text: "Export Excel data guru berhasil dibuat." });
  };

  const handleTeacherExportPdf = async () => {
    const success = openPrintableReport(
      "Laporan Data Guru",
      ["NIP", "Nama Lengkap", "Mata Pelajaran", "Riwayat Pendidikan", "Status", "Kontak"],
      teachers.map((teacher) => [
        teacher.nip,
        teacher.full_name,
        teacher.subjects.join(", "),
        teacher.education_history.join(" | "),
        teacher.employment_status,
        [teacher.contact_phone, teacher.contact_email].filter(Boolean).join(" / ") || "-",
      ]),
    );

    if (!success) {
      setMessage({ type: "error", text: "Popup browser diblokir. Izinkan popup untuk mencetak PDF." });
      return;
    }

    await createActivityLog({
      module_name: "teachers",
      action: "export",
      description: `Mengekspor ${teachers.length} data guru ke PDF.`,
      metadata: { format: "pdf", total: teachers.length },
    });
    await loadAuditData();
    setMessage({ type: "success", text: "Tampilan cetak data guru siap disimpan sebagai PDF." });
  };

  const handleStudentExportExcel = async () => {
    await downloadWorkbook("Data Siswa", "Data_Siswa_Al-Fahmi.xlsx", createStudentExportRows(students));
    await createActivityLog({
      module_name: "students",
      action: "export",
      description: `Mengekspor ${students.length} data siswa ke Excel.`,
      metadata: { format: "xlsx", total: students.length },
    });
    await loadAuditData();
    setMessage({ type: "success", text: "Export Excel data siswa berhasil dibuat." });
  };

  const handleStudentExportPdf = async () => {
    const success = openPrintableReport(
      "Laporan Data Siswa",
      ["NIS", "Nama Lengkap", "Kelas", "Jurusan", "Status", "Telepon", "Orang Tua/Wali"],
      students.map((student) => [
        student.nis,
        student.full_name,
        student.class_name,
        student.major,
        student.student_status,
        student.phone ?? "-",
        [student.guardian_info.fatherName, student.guardian_info.motherName, student.guardian_info.guardianName].filter(Boolean).join(" / ") || "-",
      ]),
    );

    if (!success) {
      setMessage({ type: "error", text: "Popup browser diblokir. Izinkan popup untuk mencetak PDF." });
      return;
    }

    await createActivityLog({
      module_name: "students",
      action: "export",
      description: `Mengekspor ${students.length} data siswa ke PDF.`,
      metadata: { format: "pdf", total: students.length },
    });
    await loadAuditData();
    setMessage({ type: "success", text: "Tampilan cetak data siswa siap disimpan sebagai PDF." });
  };

  const handleStudentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setImportingStudents(true);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await loadXlsx();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

      if (rows.length === 0) {
        setMessage({ type: "error", text: "File import kosong atau format sheet tidak dikenali." });
        return;
      }

      let created = 0;
      let updated = 0;
      let failed = 0;
      const localStudents = [...students];

      for (const rawRow of rows) {
        const row = normalizeSpreadsheetRow(rawRow);
        const form: StudentFormState = {
          nis: getSpreadsheetValue(row, ["nis", "nomorinduksiswa", "noinduksiswa"]),
          fullName: getSpreadsheetValue(row, ["nama", "namalengkap", "nama_siswa", "namasiswa"]),
          className: getSpreadsheetValue(row, ["kelas", "class", "classname"]),
          major: getSpreadsheetValue(row, ["jurusan", "major"]),
          studentStatus: normalizeStudentStatus(getSpreadsheetValue(row, ["status", "studentstatus"])),
          fatherName: getSpreadsheetValue(row, ["ayah", "namaayah", "fathername"]),
          motherName: getSpreadsheetValue(row, ["ibu", "namaibu", "mothername"]),
          guardianName: getSpreadsheetValue(row, ["wali", "orangtuawali", "guardianname"]),
          relationship: getSpreadsheetValue(row, ["hubungan", "relationship"]),
          guardianPhone: getSpreadsheetValue(row, ["teleponortu", "phoneortu", "teleponwali", "guardianphone"]),
          occupation: getSpreadsheetValue(row, ["pekerjaanortu", "occupation"]),
          address: getSpreadsheetValue(row, ["alamat", "alamatlengkap", "address"]),
          phone: getSpreadsheetValue(row, ["telepon", "nomortelepon", "phone"]),
          academicHistory: getSpreadsheetValue(row, ["riwayatakademik", "academichistory", "riwayat"]),
          notes: getSpreadsheetValue(row, ["catatan", "notes"]),
        };

        const existingStudent = localStudents.find((student) => student.nis === form.nis.trim());
        const validationErrors = validateStudentForm(form, localStudents, existingStudent?.id ?? null);

        if (validationErrors.length > 0) {
          failed += 1;
          continue;
        }

        const payload = buildStudentPayload(form, existingStudent?.photo_url ?? null);
        const result = existingStudent ? await updateStudent(existingStudent.id, payload) : await createStudent(payload);

        if (result.error || !result.data) {
          failed += 1;
          continue;
        }

        if (existingStudent) {
          updated += 1;
          const index = localStudents.findIndex((student) => student.id === existingStudent.id);
          if (index >= 0) {
            localStudents[index] = result.data;
          }
        } else {
          created += 1;
          localStudents.unshift(result.data);
        }
      }

      await createActivityLog({
        module_name: "students",
        action: "import",
        description: `Import Excel siswa selesai: ${created} ditambahkan, ${updated} diperbarui, ${failed} gagal.`,
        metadata: { file_name: file.name, created, updated, failed, total: rows.length },
      });
      await Promise.all([loadStudentData(), loadAuditData()]);
      setMessage({ type: failed > 0 ? "info" : "success", text: `Import selesai. ${created} data baru, ${updated} diperbarui, ${failed} gagal.` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setMessage({ type: "error", text: `Gagal memproses file import: ${errorMessage}` });
    } finally {
      setImportingStudents(false);
    }
  };

  const auditNotice = useMemo(() => {
    if (!user) {
      return "";
    }

    return `Akses modul ini dibatasi untuk role admin. Saat ini Anda masuk sebagai ${user.role}.`;
  }, [user]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SectionHeader title="Manajemen Data Guru & Siswa" description="Kelola master data guru dan siswa dengan validasi, pencarian, filter, import/export, audit trail, backup otomatis, serta kontrol akses yang lebih ketat." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Guru Tersedia" value={teachers.length} description={`${activeTeacherCount} guru aktif pada hasil filter saat ini.`} icon={UserRoundCog} />
        <StatCard label="Siswa Tersedia" value={students.length} description={`${activeStudentCount} siswa aktif pada hasil filter saat ini.`} icon={GraduationCap} />
        <StatCard label="Audit Trail" value={`${activityLogs.length} Log`} description="Mencatat CRUD, import, export, upload, dan backup." icon={ShieldCheck} />
        <StatCard label="Backup Otomatis" value={`${studentBackups.length} Snapshot`} description="Backup siswa tersimpan otomatis setiap perubahan." icon={History} />
      </div>

      <div className="rounded-[2rem] border border-white/25 bg-[#000080] px-4 py-5 text-white shadow-[0_24px_70px_-36px_rgba(0,0,128,0.35)] sm:px-6">
        <p className="text-sm text-white/75">Kontrol Akses & Kepatuhan Data</p>
        <p className="mt-2 text-xl font-semibold">RBAC Admin, Audit Trail Lengkap, dan Backup Data Siswa Otomatis</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">{auditNotice}</p>
      </div>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === "error" ? "border-red-200 bg-red-50 text-red-700" : message.type === "info" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {[
          { key: "guru" as TabKey, label: "Modul Guru", icon: UserRoundCog },
          { key: "siswa" as TabKey, label: "Modul Siswa", icon: GraduationCap },
          { key: "audit" as TabKey, label: "Audit & Backup", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <Button key={tab.key} variant={active ? "default" : "outline"} onClick={() => setActiveTab(tab.key)} className="min-w-[160px] justify-center">
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {activeTab === "guru" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editingTeacherId ? "Ubah Data Guru" : "Tambah Data Guru"}</CardTitle>
              <CardDescription>Lengkapi identitas guru, mata pelajaran yang diampu, riwayat pendidikan, status kepegawaian, dan kontak.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleTeacherSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-nip">NIP</Label>
                    <Input id="teacher-nip" value={teacherForm.nip} onChange={(event) => setTeacherForm((prev) => ({ ...prev, nip: event.target.value }))} placeholder="Contoh: 198812012010011001" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-name">Nama Lengkap</Label>
                    <Input id="teacher-name" value={teacherForm.fullName} onChange={(event) => setTeacherForm((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="Nama guru" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-status">Status Kepegawaian</Label>
                    <select id="teacher-status" className={selectClassName} value={teacherForm.employmentStatus} onChange={(event) => setTeacherForm((prev) => ({ ...prev, employmentStatus: event.target.value as TeacherEmploymentStatus }))}>
                      {teacherStatusOptions
                        .filter((option) => option !== "Semua Status")
                        .map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-phone">Nomor Kontak</Label>
                    <Input id="teacher-phone" value={teacherForm.contactPhone} onChange={(event) => setTeacherForm((prev) => ({ ...prev, contactPhone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-email">Email</Label>
                  <Input id="teacher-email" value={teacherForm.contactEmail} onChange={(event) => setTeacherForm((prev) => ({ ...prev, contactEmail: event.target.value }))} placeholder="guru@alfahmi.sch.id" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-subjects">Mata Pelajaran yang Diampu</Label>
                  <Textarea
                    id="teacher-subjects"
                    value={teacherForm.subjects}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, subjects: event.target.value }))}
                    placeholder={"Satu mapel per baris\nTahfidz\nTahsin"}
                    className="min-h-[110px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-education">Riwayat Pendidikan</Label>
                  <Textarea
                    id="teacher-education"
                    value={teacherForm.educationHistory}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, educationHistory: event.target.value }))}
                    placeholder={"Satu riwayat per baris\nS1 Pendidikan Agama Islam\nPelatihan Tahsin Bersertifikat"}
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-address">Alamat/Kontak Tambahan</Label>
                  <Textarea
                    id="teacher-address"
                    value={teacherForm.contactAddress}
                    onChange={(event) => setTeacherForm((prev) => ({ ...prev, contactAddress: event.target.value }))}
                    placeholder="Alamat korespondensi atau kontak tambahan"
                    className="min-h-[96px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-notes">Catatan</Label>
                  <Textarea id="teacher-notes" value={teacherForm.notes} onChange={(event) => setTeacherForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Catatan internal admin" className="min-h-[96px]" />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={resetTeacherForm}>
                    Reset Form
                  </Button>
                  <Button type="submit" disabled={savingTeacher}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingTeacher ? "Menyimpan..." : editingTeacherId ? "Simpan Perubahan" : "Tambah Guru"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daftar Guru</CardTitle>
              <CardDescription>Pencarian berdasarkan NIP, nama, email, atau nomor kontak. Gunakan filter mapel dan status untuk mempersempit hasil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-2">
                  <Label>Pencarian</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={teacherFilters.search} onChange={(event) => setTeacherFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Cari NIP, nama, email, atau kontak" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Filter Mapel</Label>
                  <select className={selectClassName} value={teacherFilters.subject} onChange={(event) => setTeacherFilters((prev) => ({ ...prev, subject: event.target.value }))}>
                    {subjectOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Filter Status</Label>
                  <select className={selectClassName} value={teacherFilters.status} onChange={(event) => setTeacherFilters((prev) => ({ ...prev, status: event.target.value as TeacherEmploymentStatus | "Semua Status" }))}>
                    {teacherStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  {loadingTeachers ? "Memuat data guru..." : `${teachers.length} data guru tampil`}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" onClick={() => void loadTeacherData()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Muat Ulang
                  </Button>
                  <Button variant="outline" onClick={() => void handleTeacherExportExcel()}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export Excel
                  </Button>
                  <Button variant="outline" onClick={() => void handleTeacherExportPdf()}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>

              <div className="space-y-3 xl:hidden">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="rounded-2xl border border-border/80 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{teacher.full_name}</p>
                        <p className="text-sm text-muted-foreground">{teacher.nip}</p>
                      </div>
                      <StatusBadge value={teacher.employment_status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{teacher.subjects.join(", ")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{teacher.contact_phone ?? teacher.contact_email ?? "Kontak belum diisi"}</p>
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleTeacherEdit(teacher)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={() => void handleTeacherDelete(teacher)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                ))}
                {!loadingTeachers && teachers.length === 0 && <EmptyState title="Data Guru Belum Tersedia" description="Tambahkan guru baru atau ubah filter pencarian untuk melihat data yang tersedia." icon={UserRoundCog} />}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-border/80 xl:block">
                <table className="min-w-[940px] w-full text-left text-sm">
                  <thead className="border-b bg-[#f5f6ff]">
                    <tr>
                      <th className="p-3 font-medium">Guru</th>
                      <th className="p-3 font-medium">Mapel</th>
                      <th className="p-3 font-medium">Pendidikan</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Kontak</th>
                      <th className="p-3 font-medium text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b last:border-0 hover:bg-[#f9faff]">
                        <td className="p-3 align-top">
                          <p className="font-semibold text-slate-900">{teacher.full_name}</p>
                          <p className="text-xs text-muted-foreground">{teacher.nip}</p>
                        </td>
                        <td className="p-3 align-top">{teacher.subjects.join(", ")}</td>
                        <td className="p-3 align-top">{teacher.education_history.join(" | ")}</td>
                        <td className="p-3 align-top">
                          <StatusBadge value={teacher.employment_status} />
                        </td>
                        <td className="p-3 align-top">
                          <p>{teacher.contact_phone ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">{teacher.contact_email ?? "-"}</p>
                        </td>
                        <td className="p-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleTeacherEdit(teacher)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => void handleTeacherDelete(teacher)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loadingTeachers && teachers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4">
                          <EmptyState title="Data Guru Belum Tersedia" description="Tambahkan guru baru atau ubah filter pencarian untuk melihat data yang tersedia." icon={UserRoundCog} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "siswa" && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <Card>
            <CardHeader>
              <CardTitle>{editingStudentId ? "Ubah Data Siswa" : "Tambah Data Siswa"}</CardTitle>
              <CardDescription>Kelola NIS, kelas, jurusan, data orang tua/wali, alamat, telepon, riwayat akademik, dan foto profil siswa.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleStudentSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-nis">NIS</Label>
                    <Input id="student-nis" value={studentForm.nis} onChange={(event) => setStudentForm((prev) => ({ ...prev, nis: event.target.value }))} placeholder="Nomor induk siswa" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Nama Lengkap</Label>
                    <Input id="student-name" value={studentForm.fullName} onChange={(event) => setStudentForm((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="Nama siswa" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="student-class">Kelas</Label>
                    <Input id="student-class" value={studentForm.className} onChange={(event) => setStudentForm((prev) => ({ ...prev, className: event.target.value }))} placeholder="Contoh: 10A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-major">Jurusan</Label>
                    <Input id="student-major" value={studentForm.major} onChange={(event) => setStudentForm((prev) => ({ ...prev, major: event.target.value }))} placeholder="Contoh: Tahfidz" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-status">Status</Label>
                    <select id="student-status" className={selectClassName} value={studentForm.studentStatus} onChange={(event) => setStudentForm((prev) => ({ ...prev, studentStatus: event.target.value as StudentStatus }))}>
                      {studentStatusOptions
                        .filter((option) => option !== "Semua Status")
                        .map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-father">Nama Ayah</Label>
                    <Input id="student-father" value={studentForm.fatherName} onChange={(event) => setStudentForm((prev) => ({ ...prev, fatherName: event.target.value }))} placeholder="Nama ayah" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-mother">Nama Ibu</Label>
                    <Input id="student-mother" value={studentForm.motherName} onChange={(event) => setStudentForm((prev) => ({ ...prev, motherName: event.target.value }))} placeholder="Nama ibu" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="student-guardian">Nama Wali</Label>
                    <Input id="student-guardian" value={studentForm.guardianName} onChange={(event) => setStudentForm((prev) => ({ ...prev, guardianName: event.target.value }))} placeholder="Jika berbeda dengan orang tua" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-relationship">Hubungan</Label>
                    <Input id="student-relationship" value={studentForm.relationship} onChange={(event) => setStudentForm((prev) => ({ ...prev, relationship: event.target.value }))} placeholder="Ayah / Ibu / Paman / Wali" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-guardian-phone">Telepon Orang Tua/Wali</Label>
                    <Input id="student-guardian-phone" value={studentForm.guardianPhone} onChange={(event) => setStudentForm((prev) => ({ ...prev, guardianPhone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="student-occupation">Pekerjaan Orang Tua/Wali</Label>
                    <Input id="student-occupation" value={studentForm.occupation} onChange={(event) => setStudentForm((prev) => ({ ...prev, occupation: event.target.value }))} placeholder="Pekerjaan" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-phone">Nomor Telepon Siswa</Label>
                    <Input id="student-phone" value={studentForm.phone} onChange={(event) => setStudentForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="08xxxxxxxxxx" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-address">Alamat Lengkap</Label>
                  <Textarea id="student-address" value={studentForm.address} onChange={(event) => setStudentForm((prev) => ({ ...prev, address: event.target.value }))} placeholder="Alamat lengkap siswa" className="min-h-[110px]" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-academic">Riwayat Akademik</Label>
                  <Textarea
                    id="student-academic"
                    value={studentForm.academicHistory}
                    onChange={(event) => setStudentForm((prev) => ({ ...prev, academicHistory: event.target.value }))}
                    placeholder={"Satu poin per baris\nSemester 1 - Nilai rata-rata 88\nJuara Tahfidz tingkat sekolah"}
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">Foto Profil Siswa</p>
                      <p className="text-sm text-muted-foreground">Unggah JPG, PNG, atau WEBP maksimal 5MB. Foto akan disimpan saat form disubmit.</p>
                    </div>
                    <ImagePlus className="h-5 w-5 text-primary" />
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setStudentPhotoFile(event.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary"
                  />
                  {(studentPhotoFile || existingStudentPhotoUrl) && (
                    <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3">
                      <img src={studentPhotoFile ? URL.createObjectURL(studentPhotoFile) : (existingStudentPhotoUrl ?? "")} alt="Preview foto siswa" className="h-16 w-16 rounded-2xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{studentPhotoFile?.name ?? "Foto tersimpan"}</p>
                        <p className="text-xs text-muted-foreground">{studentPhotoFile ? `${Math.round(studentPhotoFile.size / 1024)} KB` : "Foto profil aktif saat ini"}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student-notes">Catatan</Label>
                  <Textarea id="student-notes" value={studentForm.notes} onChange={(event) => setStudentForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Catatan internal admin" className="min-h-[96px]" />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={resetStudentForm}>
                    Reset Form
                  </Button>
                  <Button type="submit" disabled={savingStudent}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingStudent ? "Menyimpan..." : editingStudentId ? "Simpan Perubahan" : "Tambah Siswa"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Filter & Import Data Siswa</CardTitle>
                <CardDescription>Pencarian multi-kriteria berdasarkan NIS, nama, kelas, jurusan, atau nomor telepon. Tersedia juga import data dari Excel.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2 xl:col-span-2">
                    <Label>Pencarian Multi-Kriteria</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={studentFilters.search} onChange={(event) => setStudentFilters((prev) => ({ ...prev, search: event.target.value }))} placeholder="Cari NIS, nama, kelas, jurusan, atau telepon" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Filter Kelas</Label>
                    <select className={selectClassName} value={studentFilters.className} onChange={(event) => setStudentFilters((prev) => ({ ...prev, className: event.target.value }))}>
                      {classOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Filter Jurusan</Label>
                    <select className={selectClassName} value={studentFilters.major} onChange={(event) => setStudentFilters((prev) => ({ ...prev, major: event.target.value }))}>
                      {majorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto]">
                  <div className="space-y-2">
                    <Label>Filter Status</Label>
                    <select className={selectClassName} value={studentFilters.status} onChange={(event) => setStudentFilters((prev) => ({ ...prev, status: event.target.value as StudentStatus | "Semua Status" }))}>
                      {studentStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Import Excel</Label>
                    <div className="flex gap-2">
                      <label className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-2xl border border-border bg-white/80 px-4 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white">
                        <Upload className="mr-2 h-4 w-4" />
                        {importingStudents ? "Memproses..." : "Pilih File"}
                        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => void handleStudentImport(event)} disabled={importingStudents} />
                      </label>
                      <a
                        href="/template-import-siswa.csv"
                        download
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white/80 px-4 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-white"
                      >
                        Template
                      </a>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Mendukung `xlsx`, `xls`, dan `csv`. Header yang dibaca antara lain `nis`, `namalengkap`, `kelas`, `jurusan`, `status`, `ayah`, `ibu`, `wali`, `hubungan`, `teleponortu`, `pekerjaanortu`, `alamat`, `telepon`,
                      `riwayatakademik`, dan `catatan`.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Export Excel</Label>
                    <Button variant="outline" className="w-full" onClick={() => void handleStudentExportExcel()}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Export PDF</Label>
                    <Button variant="outline" className="w-full" onClick={() => void handleStudentExportPdf()}>
                      <Download className="mr-2 h-4 w-4" />
                      Cetak
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-slate-900">Panduan Import Siswa</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Unduh template, isi data sesuai header, lalu unggah kembali dalam format `xlsx`, `xls`, atau `csv`. Baris dengan NIS yang sudah ada akan diperbarui, sedangkan NIS baru akan ditambahkan.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Kolom penting: `nis`, `namalengkap`, `kelas`, `jurusan`, `status`, `alamat`, `riwayatakademik`. Nilai `riwayatakademik` dapat dipisahkan dengan titik koma `;`.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daftar Siswa</CardTitle>
                <CardDescription>Data siswa dilengkapi riwayat akademik, kontak orang tua/wali, foto profil, serta backup otomatis setiap perubahan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  {loadingStudents ? "Memuat data siswa..." : `${students.length} data siswa tampil`}
                </div>

                <div className="space-y-3 xl:hidden">
                  {students.map((student) => (
                    <div key={student.id} className="rounded-2xl border border-border/80 bg-white/80 p-4">
                      <div className="flex items-start gap-3">
                        <img src={student.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(student.full_name)}&background=000080&color=fff`} alt={student.full_name} className="h-14 w-14 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{student.full_name}</p>
                              <p className="text-sm text-muted-foreground">{student.nis}</p>
                            </div>
                            <StatusBadge value={student.student_status} />
                          </div>
                          <p className="mt-2 text-sm text-slate-700">
                            {student.class_name} • {student.major}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{student.phone ?? student.guardian_info.phone ?? "Kontak belum diisi"}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleStudentEdit(student)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" className="flex-1" onClick={() => void handleStudentDelete(student)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!loadingStudents && students.length === 0 && <EmptyState title="Data Siswa Belum Tersedia" description="Tambahkan data siswa, lakukan import Excel, atau ubah filter pencarian." icon={GraduationCap} />}
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border border-border/80 xl:block">
                  <table className="min-w-[1100px] w-full text-left text-sm">
                    <thead className="border-b bg-[#f5f6ff]">
                      <tr>
                        <th className="p-3 font-medium">Siswa</th>
                        <th className="p-3 font-medium">Kelas/Jurusan</th>
                        <th className="p-3 font-medium">Orang Tua/Wali</th>
                        <th className="p-3 font-medium">Kontak</th>
                        <th className="p-3 font-medium">Riwayat Akademik</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id} className="border-b last:border-0 hover:bg-[#f9faff]">
                          <td className="p-3 align-top">
                            <div className="flex items-start gap-3">
                              <img src={student.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(student.full_name)}&background=000080&color=fff`} alt={student.full_name} className="h-12 w-12 rounded-2xl object-cover" />
                              <div>
                                <p className="font-semibold text-slate-900">{student.full_name}</p>
                                <p className="text-xs text-muted-foreground">{student.nis}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <p>{student.class_name}</p>
                            <p className="text-xs text-muted-foreground">{student.major}</p>
                          </td>
                          <td className="p-3 align-top">
                            <p>{[student.guardian_info.fatherName, student.guardian_info.motherName, student.guardian_info.guardianName].filter(Boolean).join(" / ") || "-"}</p>
                            <p className="text-xs text-muted-foreground">{student.guardian_info.relationship || "-"}</p>
                          </td>
                          <td className="p-3 align-top">
                            <p>{student.phone ?? "-"}</p>
                            <p className="text-xs text-muted-foreground">{student.guardian_info.phone || "-"}</p>
                          </td>
                          <td className="p-3 align-top">{student.academic_history.join(" | ")}</td>
                          <td className="p-3 align-top">
                            <StatusBadge value={student.student_status} />
                          </td>
                          <td className="p-3 align-top">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleStudentEdit(student)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => void handleStudentDelete(student)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!loadingStudents && students.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-4">
                            <EmptyState title="Data Siswa Belum Tersedia" description="Tambahkan data siswa, lakukan import Excel, atau ubah filter pencarian." icon={GraduationCap} />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Log Aktivitas Lengkap</CardTitle>
              <CardDescription>Menampilkan audit trail untuk perubahan data guru, siswa, impor, ekspor, unggah foto, dan event sistem backup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label>Filter Modul Log</Label>
                  <select className={selectClassName} value={logFilter} onChange={(event) => setLogFilter(event.target.value as LogFilter)}>
                    <option value="all">Semua Modul</option>
                    <option value="teachers">Guru</option>
                    <option value="students">Siswa</option>
                    <option value="system">Sistem</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Muat Ulang</Label>
                  <Button variant="outline" className="w-full" onClick={() => void loadAuditData()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-border/70 bg-white/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={log.action} />
                          <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-medium text-[#000080]">{log.module_name}</span>
                        </div>
                        <p className="mt-3 font-medium text-slate-900">{log.description}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Aktor: {log.actor_id ? (actorNames[log.actor_id] ?? log.actor_id) : "Sistem"} • Entitas: {log.entity_label ?? "-"}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDateTime(log.created_at)}</p>
                    </div>
                  </div>
                ))}
                {!loadingAudit && activityLogs.length === 0 && <EmptyState title="Belum Ada Log Aktivitas" description="Audit trail akan muncul setelah ada perubahan data atau aktivitas sistem." icon={ShieldCheck} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup Otomatis Siswa</CardTitle>
              <CardDescription>Snapshot otomatis dibuat setiap data siswa ditambah, diubah, atau dihapus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentBackups.map((backup) => {
                const snapshotName = typeof backup.snapshot.full_name === "string" ? backup.snapshot.full_name : "Siswa";
                const snapshotNis = typeof backup.snapshot.nis === "string" ? backup.snapshot.nis : "-";

                return (
                  <div key={backup.id} className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={backup.backup_type} />
                          <span className="text-sm font-medium text-slate-900">{snapshotName}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">NIS {snapshotNis}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDateTime(backup.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              {!loadingAudit && studentBackups.length === 0 && <EmptyState title="Belum Ada Backup" description="Snapshot backup akan muncul otomatis setelah perubahan data siswa." icon={History} />}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
