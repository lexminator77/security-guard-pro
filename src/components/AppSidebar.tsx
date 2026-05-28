// @ts-nocheck
import {
  Sun, GraduationCap, BookOpen, Calendar,
  Users, UserCheck, Building2,
  ShieldCheck, RefreshCw, Award, AlertTriangle,
  Receipt, Landmark, BarChart3,
  Sparkles, FileText, MessageSquare, Bell,
  LogOut, UserCog, ClipboardList, MessageSquareWarning, Shield,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";

type R = "administrateur" | "formateur" | "agent" | "secretaire" | "stagiaire";
type NavItem = {
  title: string;
  url: string;
  icon: any;
  roles: R[];
  bump?: string;
  alert?: boolean;
  ai?: boolean;
};

const allGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    items: [
      { title: "Aujourd'hui",  url: "/",  icon: Sun,  roles: ["administrateur","formateur","agent","secretaire","stagiaire"] },
    ],
  },
  {
    label: "Formation",
    items: [
      { title: "Sessions",  url: "/formations", icon: GraduationCap, roles: ["administrateur","secretaire","formateur","stagiaire"] },
      { title: "Catalogue", url: "/cours",       icon: BookOpen,      roles: ["administrateur"] },
      { title: "Planning",  url: "/planning",    icon: Calendar,      roles: ["administrateur","secretaire","formateur","stagiaire","agent"] },
    ],
  },
  {
    label: "Personnes",
    items: [
      { title: "Stagiaires",   url: "/stagiaires",  icon: Users,      roles: ["administrateur","secretaire"] },
      { title: "Formateurs",   url: "/formateurs",  icon: UserCheck,  roles: ["administrateur","secretaire"] },
      { title: "Entreprises",  url: "/entreprises", icon: Building2,  roles: ["administrateur","secretaire"] },
    ],
  },
  {
    label: "Conformité",
    items: [
      { title: "Cartes pro CNAPS",  url: "/verification-cnaps", icon: ShieldCheck,  roles: ["administrateur","secretaire"], alert: true },
      { title: "Recyclages",        url: "/formations",         icon: RefreshCw,    roles: ["administrateur","secretaire"] },
      { title: "Qualiopi",           url: "/audit",              icon: ClipboardList, roles: ["administrateur"] },
      { title: "Incidents",         url: "/incidents",          icon: AlertTriangle, roles: ["administrateur","secretaire","formateur","agent"] },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Facturation",  url: "/facturation",       icon: Receipt,   roles: ["administrateur","secretaire"] },
      { title: "OPCO / CPF",   url: "/financement-opco",  icon: Landmark,  roles: ["administrateur","secretaire"] },
      { title: "Statistiques", url: "/statistiques",      icon: BarChart3, roles: ["administrateur"] },
    ],
  },
  {
    label: "Outils",
    items: [
      { title: "Documents",       url: "/documents",         icon: FileText,           roles: ["administrateur","secretaire"] },
      { title: "Messagerie",      url: "/messagerie-admin",  icon: MessageSquare,      roles: ["administrateur"] },
      { title: "Rappels & Alertes", url: "/rappels",         icon: Bell,               roles: ["administrateur"] },
      { title: "Réclamations",    url: "/reclamations",      icon: MessageSquareWarning, roles: ["administrateur","secretaire"] },
      { title: "Compétences",     url: "/competences",       icon: Award,              roles: ["administrateur"] },
      { title: "Utilisateurs",    url: "/utilisateurs",      icon: UserCog,            roles: ["administrateur"] },
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
          <div className="h-8 w-8 rounded-[9px] gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <span className="font-bold text-sm text-white">S</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-bold text-sm text-foreground truncate">SecureCRM</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                AV Sécurité Royan
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {allGroups.map((group, gi) => {
          const visibleItems = group.items.filter(i =>
            i.roles.some(r => (roles as R[]).includes(r))
          );
          if (visibleItems.length === 0) return null;
          return (
            <SidebarGroup key={gi}>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-[.14em] text-muted-foreground/50 font-semibold px-3 pt-3 pb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active}>
                          <NavLink
                            to={item.url}
                            end={item.url === "/"}
                            className={({ isActive: a }) =>
                              [
                                "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all relative",
                                a
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-primary/20"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground border border-transparent",
                                item.alert && !a ? "text-destructive" : "",
                                item.ai && !a ? "text-sidebar-primary" : "",
                              ].filter(Boolean).join(" ")
                            }
                          >
                            {/* Active indicator bar */}
                            {active && (
                              <span className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-primary rounded-r-full" />
                            )}
                            <item.icon
                              className={[
                                "h-4 w-4 shrink-0",
                                active ? "text-primary" : "opacity-75",
                              ].join(" ")}
                            />
                            {!collapsed && (
                              <>
                                <span className="flex-1 truncate">{item.title}</span>
                                {item.bump && (
                                  <span
                                    className={[
                                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                      item.alert
                                        ? "bg-destructive text-white"
                                        : "bg-secondary text-muted-foreground",
                                    ].join(" ")}
                                  >
                                    {item.bump}
                                  </span>
                                )}
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 mb-1 px-1">
            <div className="h-[30px] w-[30px] rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] font-bold text-foreground shrink-0">
              {user.email?.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate">{user.email}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{(roles as R[])[0]}</p>
            </div>
          </div>
        )}
        <SidebarMenuButton
          onClick={signOut}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Déconnexion</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
