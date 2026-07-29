import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";

export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AdminNavigation />
      {children}
    </>
  );
}
