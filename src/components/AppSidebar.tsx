// @ts-nocheck
import {
  LayoutDashboard, Users, GraduationCap, AlertTriangle,
  Calendar, FileText, BarChart3, Shield,
  LogOut, UserCog, UserCheck, Award, ClipboardList, BookOpen, MessageSquare, MessageSquareWarning, Bell, Building2, Receipt, Landmark, ShieldCheck
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

type R = "administrateur" | "formateur" | "agent" | "secretaire" | "stagiaire";
type NavItem = { title: string; url: string; icon: any; roles: R[] };

const allGroups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: ["administrateur","formateur","agent","secretaire","stagiaire"] },
    ],
  },
  {
    label: "Formation",
    items: [
      { title: "Formations", url: "/formations", icon: GraduationCap, roles: ["administrateur","secretaire","formateur","stagiaire"] },
      { title: "Planning", url: "/planning", icon: Calendar, roles: ["administrateur","secretaire","formateur","stagiaire","agent"] },
      { title: "Cours", url: "/cours", icon: BookOpen, roles: ["administrateur"] },
    ],
  },
  {
    label: "Personnes",
    items: [
      { title: "Stagiaires", url: "/stagiaires", icon: Users, roles: ["administrateur","secretaire"] },
      { title: "Formateurs", url: "/formateurs", icon: UserCheck, roles: ["administrateur","secretaire"] },
    ],
  },
  {
    label: "Entreprises",
    items: [
      { title: "Entreprises", url: "/entreprises", icon: Building2, roles: ["administrateur","secretaire"] },
      { title: "Documents", url: "/documents", icon: FileText, roles: ["administrateur","secretaire"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Statistiques", url: "/statistiques", icon: BarChart3, roles: ["administrateur"] },
      { title: "Audit & Émargements", url: "/audit", icon: ClipboardList, roles: ["administrateur"] },
      { title: "Compétences", url: "/competences", icon: Award, roles: ["administrateur"] },
      { title: "Réclamations", url: "/reclamations", icon: MessageSquareWarning, roles: ["administrateur","secretaire"] },
      { title: "Incidents", url: "/incidents", icon: AlertTriangle, roles: ["administrateur","secretaire","formateur","agent"] },
      { title: "Facturation", url: "/facturation", icon: Receipt, roles: ["administrateur","secretaire"] },
      { title: "Financement OPCO", url: "/financement-opco", icon: Landmark, roles: ["administrateur","secretaire"] },
      { title: "DRACAR", url: "/verification-cnaps", icon: ShieldCheck, roles: ["administrateur","secretaire"] },
    ],
  },
  {
    label: "Système",
    items: [
      { title: "Utilisateurs", url: "/utilisateurs", icon: UserCog, roles: ["administrateur"] },
      { title: "Messagerie", url: "/messagerie-admin", icon: MessageSquare, roles: ["administrateur"] },
      { title: "Rappels & Alertes", url: "/rappels", icon: Bell, roles: ["administrateur"] },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { user, signOut, roles } = useAuth();
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
        {allGroups.map((group, gi) => {
          const visibleItems = group.items.filter(i => i.roles.some(r => (roles as R[]).includes(r)));
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={gi}>
              {group.label && !collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold px-2 pt-3 pb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
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
          );
        })}
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