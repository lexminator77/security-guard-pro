import {
  LayoutDashboard, Users, GraduationCap, AlertTriangle,
  Calendar, FileText, Building2, Bell, BarChart3, Shield, LogOut
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

const mainItems = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Stagiaires", url: "/stagiaires", icon: Users },
  { title: "Formations", url: "/formations", icon: GraduationCap },
  { title: "Planning", url: "/planning", icon: Calendar },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle },
];

const soonItems = [
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Entreprises", url: "/entreprises", icon: Building2 },
  { title: "Rappels", url: "/rappels", icon: Bell },
  { title: "Statistiques", url: "/statistiques", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const isActive = (p: string) => pathname === p;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display font-bold text-sm text-foreground">SecureCRM</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Sécurité & Formation</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className={({ isActive: a }) =>
                      `flex items-center gap-3 ${a ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`
                    }>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Modules à venir</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {soonItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton className="opacity-50 cursor-not-allowed" disabled>
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
        )}
        <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Déconnexion</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
