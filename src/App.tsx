import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuthStore } from "./store/auth";
import { supabase } from "./lib/supabase";

const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Absensi = lazy(() => import("./pages/Absensi").then((module) => ({ default: module.Absensi })));
const Penilaian = lazy(() => import("./pages/Penilaian").then((module) => ({ default: module.Penilaian })));
const AdminSettings = lazy(() => import("./pages/AdminSettings").then((module) => ({ default: module.AdminSettings })));
const Laporan = lazy(() => import("./pages/Laporan").then((module) => ({ default: module.Laporan })));
const NilaiSaya = lazy(() => import("./pages/NilaiSaya").then((module) => ({ default: module.NilaiSaya })));
const Profil = lazy(() => import("./pages/Profil").then((module) => ({ default: module.Profil })));
const Kalender = lazy(() => import("./pages/Kalender").then((module) => ({ default: module.Kalender })));
const DataSiswa = lazy(() => import("./pages/DataSiswa").then((module) => ({ default: module.DataSiswa })));

function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Memuat halaman...</div>;
}

export default function App() {
  const { user, initializeAuth, syncSupabaseUser } = useAuthStore();

  useEffect(() => {
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSupabaseUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, syncSupabaseUser]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

              <Route element={<ProtectedRoute allowedRoles={["guru"]} />}>
                <Route path="/absensi" element={<Absensi />} />
                <Route path="/penilaian" element={<Penilaian />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/pengaturan" element={<AdminSettings />} />
                <Route path="/laporan" element={<Laporan />} />
                <Route path="/siswa" element={<DataSiswa />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["siswa"]} />}>
                <Route path="/nilai-saya" element={<NilaiSaya />} />
              </Route>

              <Route path="/profil" element={<Profil />} />
              <Route path="/kalender" element={<Kalender />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
