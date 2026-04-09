import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useAuthStore } from "@/store/auth";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { createCalendarEvent, deleteCalendarEvent, fetchCalendarEvents, updateCalendarEvent } from "@/lib/supabase-data";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
}

export function Kalender() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [events]);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      const { data, error } = await fetchCalendarEvents();

      if (error) {
        setMessage(`Gagal memuat agenda: ${error.message}`);
        setLoading(false);
        return;
      }

      setEvents(
        (data ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description ?? "",
          date: event.event_date,
        }))
      );
      setLoading(false);
    };

    void loadEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;
    setLoading(true);
    setMessage(null);

    if (editingId) {
      const { data, error } = await updateCalendarEvent(editingId, {
        title: newEvent.title,
        description: newEvent.description || null,
        event_date: newEvent.date,
      });

      if (error) {
        setMessage(`Gagal memperbarui agenda: ${error.message}`);
        setLoading(false);
        return;
      }

      setEvents(events.map((event) => (event.id === editingId ? { id: data.id, title: data.title, description: data.description ?? "", date: data.event_date } : event)));
      setEditingId(null);
    } else {
      const { data, error } = await createCalendarEvent({
        title: newEvent.title,
        description: newEvent.description || null,
        event_date: newEvent.date,
      });

      if (error) {
        setMessage(`Gagal menambah agenda: ${error.message}`);
        setLoading(false);
        return;
      }

      setEvents([...events, { id: data.id, title: data.title, description: data.description ?? "", date: data.event_date }]);
    }

    setMessage("Agenda berhasil disimpan.");
    setNewEvent({ title: "", description: "", date: "" });
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setMessage(null);
    const { error } = await deleteCalendarEvent(id);

    if (error) {
      setMessage(`Gagal menghapus agenda: ${error.message}`);
      setLoading(false);
      return;
    }

    setEvents(events.filter((e) => e.id !== id));
    setMessage("Agenda berhasil dihapus.");
    setLoading(false);
  };

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setNewEvent({ title: event.title, description: event.description, date: event.date });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <SectionHeader title="Kalender Sekolah" description="Pantau jadwal kegiatan akademik dan acara sekolah dalam tampilan agenda yang lebih rapi." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Agenda Terjadwal" value={events.length} description="Agenda sekolah yang sedang aktif pada kalender." icon={CalendarDays} />
        <StatCard label="Peran Anda" value={isAdmin ? "Admin" : "Viewer"} description={isAdmin ? "Dapat menambah dan menghapus agenda." : "Hanya dapat melihat agenda sekolah."} icon={CalendarDays} />
        <StatCard label="Agenda Terdekat" value={sortedEvents[0] ? new Date(sortedEvents[0].date).toLocaleDateString("id-ID") : "-"} description="Tanggal acara yang paling dekat dari daftar saat ini." icon={CalendarDays} />
      </div>

      {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.startsWith("Gagal") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{message}</div>}
      {loading && events.length === 0 && <div className="rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm text-muted-foreground">Memuat agenda sekolah...</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {sortedEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-[80px] flex-row items-center justify-center gap-3 rounded-2xl bg-[#f5f6ff] p-3 text-primary sm:flex-col sm:gap-0">
                    <span className="text-sm font-semibold uppercase">{new Date(event.date).toLocaleDateString("id-ID", { month: "short" })}</span>
                    <span className="text-2xl font-bold">{new Date(event.date).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{event.description}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 self-start sm:self-auto">
                      <Button variant="ghost" size="icon" className="text-primary hover:text-primary" onClick={() => handleEdit(event)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          {!loading && events.length === 0 && <EmptyState title="Belum Ada Agenda Sekolah" description="Tambahkan kegiatan baru agar guru dan siswa dapat melihat agenda penting pada dashboard." icon={CalendarDays} />}
        </div>

        {isAdmin && (
          <div>
            <Card className="xl:sticky xl:top-6">
              <CardHeader>
                <CardTitle className="text-lg">{editingId ? "Edit Agenda" : "Tambah Agenda"}</CardTitle>
                <CardDescription>{editingId ? "Perbarui detail agenda sekolah yang sudah ada." : "Masukkan jadwal kegiatan baru ke kalender."}</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddEvent}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Tanggal</Label>
                    <Input id="date" type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Acara</Label>
                    <Input id="title" placeholder="Contoh: Rapat Guru" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc">Deskripsi</Label>
                    <Input id="desc" placeholder="Detail singkat..." value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
                  </div>
                </CardContent>
                <CardContent className="space-y-3 pt-0">
                  <Button type="submit" className="w-full" disabled={loading}>
                    <Plus className="mr-2 h-4 w-4" /> {editingId ? "Simpan Perubahan" : "Tambah Agenda"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setEditingId(null);
                        setNewEvent({ title: "", description: "", date: "" });
                      }}
                    >
                      Batal Edit
                    </Button>
                  )}
                </CardContent>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
