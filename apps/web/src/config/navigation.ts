import {
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const mainNavigation: NavigationItem[] = [
  { label: "Resumen", href: "/", icon: LayoutDashboard },
  { label: "Empresas", href: "/companies", icon: Building2 },
  { label: "Usuarios", href: "/users", icon: Users, disabled: true },
  { label: "Documentos", href: "#", icon: FileText, disabled: true },
];

export const secondaryNavigation: NavigationItem[] = [
  { label: "Configuración", href: "#", icon: Settings, disabled: true },
];
