import { useEffect, useState, useRef } from "react";
import { Bell, Clock, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  type_alerte: string;
  lu: boolean;
  created_at: string;
  certification_id: string | null;
}

function labelFor(type_alerte: string): string {
  switch (type_alerte) {
    case "90j": return "Alerte 90 jours";
    case "30j": return "Alerte 30 jours";
    case "7j":  return "Alerte 7 jours";
    case "expire": return "Expiration";
    default: return type_alerte;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

function AlertIcon({ type }: { type: string }) {
  if (type === "90j") return <Clock className="h-4 w-4 text-yellow-500 shrink-0" />;
  if (type === "30j") return <Clock className="h-4 w-4 text-orange-500 shrink-0" />;
  if (type === "7j")  return <Clock className="h-4 w-4 text-red-500 shrink-0" />;
  return <X className="h-4 w-4 text-red-600 shrink-0" />;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.lu).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type_alerte, lu, created_at, certification_id")
      .eq("destinataire_id", user.id)
      .eq("lu", false)
      .order("created_at", { ascending: false })
      .limit(10);
    if (!error && data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    let sub: { unsubscribe: () => void } | null = null;
    try {
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "notifications", filter: `destinataire_id=eq.${user.id}` },
          () => fetchNotifications()
        )
        .subscribe();
      sub = channel as unknown as { unsubscribe: () => void };
    } catch (e) {
      console.warn("Realtime subscription failed", e);
    }

    return () => {
      if (sub) {
        try { (sub as any).unsubscribe(); } catch { /* ignore */ }
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleClick = async (n: Notification) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", n.id);
    setOpen(false);
    navigate("/espace-stagiaire");
  };

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-md hover:bg-secondary/60 transition-colors"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {!loading && unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center px-1 leading-none">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune notification</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left"
                >
                  <AlertIcon type={n.type_alerte} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{labelFor(n.type_alerte)}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
