import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { CERTS_FORMATEUR, alertLevel, badgeClass, formatDate, monthsUntil } from "@/lib/certifications";

interface AlertItem {
  type: "formateur" | "stagiaire";
  id: string;
  name: string;
  cert: string;
  expiry: string;
  level: "expired" | "soon";
}

export default function ExpirationAlertsCard() {
  const [items, setItems] = useState<AlertItem[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const all: AlertItem[] = [];
    const { data: formateurs } = await supabase.from("formateurs").select("*");
    (formateurs ?? []).forEach((f: any) => {
      CERTS_FORMATEUR.forEach(c => {
        const lvl = alertLevel(f[c.date]);
        if (lvl === "expired" || lvl === "soon") {
          all.push({ type: "formateur", id: f.id, name: `${f.first_name} ${f.last_name}`, cert: c.label, expiry: f[c.date], level: lvl });
        }
      });
    });
    const { data: stagiaires } = await supabase.from("stagiaires").select("*");
    (stagiaires ?? []).forEach((s: any) => {
      // stagiaires: alerte 6/3/1 mois
      const m = monthsUntil(s.carte_pro_expiry);
      if (s.carte_pro_expiry && m !== null && m <= 6) {
        all.push({
          type: "stagiaire", id: s.id, name: `${s.first_name} ${s.last_name}`,
          cert: "Carte CNAPS", expiry: s.carte_pro_expiry,
          level: m < 0 ? "expired" : "soon",
        });
      }
    });
    all.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
    setItems(all);
  };

  return (
    <Card className="p-6 bg-card/60 border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h2 className="font-display font-semibold">Alertes d'échéances</h2>
        <Badge variant="outline" className="ml-auto">{items.length}</Badge>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Aucune échéance critique 🎉</p>}
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{it.name}</p>
              <p className="text-xs text-muted-foreground">{it.type} · {it.cert}</p>
            </div>
            <Badge className={badgeClass(it.level)}>{formatDate(it.expiry)}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
