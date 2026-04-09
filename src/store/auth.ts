import { create } from "zustand";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Role = "admin" | "guru" | "siswa";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  class_id?: string; // legacy or general use
  // Guru specific fields
  id_guru?: string;
  mata_pelajaran?: string;
  // Murid specific fields
  id_murid?: string;
  // Shared fields
  kelas?: string;
  sekolah?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  syncSupabaseUser: (authUser: SupabaseUser | null) => Promise<void>;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const inferRoleFromEmail = (email?: string | null): Role => {
  const normalizedEmail = email?.toLowerCase() ?? "";
  if (normalizedEmail.includes("admin")) return "admin";
  if (normalizedEmail.includes("siswa")) return "siswa";
  return "guru";
};

const mapSupabaseUser = (authUser: SupabaseUser): User => {
  const metadata = authUser.user_metadata ?? {};
  const role = (metadata.role as Role | undefined) ?? inferRoleFromEmail(authUser.email);

  return {
    id: authUser.id,
    email: authUser.email ?? "",
    name: metadata.name ?? authUser.email?.split("@")[0] ?? "User",
    role,
    class_id: metadata.class_id,
    id_guru: metadata.id_guru,
    mata_pelajaran: metadata.mata_pelajaran,
    id_murid: metadata.id_murid,
    kelas: metadata.kelas,
    sekolah: metadata.sekolah ?? "SDIT Al-Fahmi",
  };
};

const hydrateUser = async (authUser: SupabaseUser): Promise<User> => {
  const fallbackUser = mapSupabaseUser(authUser);

  const { data, error } = await supabase.from("profiles").select("name, email, role, class_id, id_guru, mata_pelajaran, id_murid, kelas, sekolah").eq("id", authUser.id).maybeSingle();

  if (error || !data) {
    return fallbackUser;
  }

  return {
    id: authUser.id,
    email: data.email ?? fallbackUser.email,
    name: data.name ?? fallbackUser.name,
    role: (data.role as Role | null) ?? fallbackUser.role,
    class_id: data.class_id ?? fallbackUser.class_id,
    id_guru: data.id_guru ?? fallbackUser.id_guru,
    mata_pelajaran: data.mata_pelajaran ?? fallbackUser.mata_pelajaran,
    id_murid: data.id_murid ?? fallbackUser.id_murid,
    kelas: data.kelas ?? fallbackUser.kelas,
    sekolah: data.sekolah ?? fallbackUser.sekolah,
  };
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null, // Default to null for unauthenticated
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  syncSupabaseUser: async (authUser) => {
    const user = authUser ? await hydrateUser(authUser) : null;

    set({
      user,
      isLoading: false,
    });
  },
  initializeAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user ? await hydrateUser(session.user) : null;

    set({
      user,
      isLoading: false,
    });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, isLoading: false });
  },
}));
