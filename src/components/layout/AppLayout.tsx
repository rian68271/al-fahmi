import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedState = window.localStorage.getItem("alfahmi-sidebar-collapsed");
    if (savedState) {
      setSidebarCollapsed(savedState === "true");
    }
  }, []);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("alfahmi-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-[#000080]/10 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-[#000080]/8 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={sidebarCollapsed} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onMenuClick={() => setMobileOpen(true)} onToggleSidebar={handleToggleSidebar} isSidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:px-4 sm:pt-4 md:px-6 md:pb-8 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </div>
  );
}
