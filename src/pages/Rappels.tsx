// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Shield, UserCheck, Users, Search, ExternalLink, Bell } from "lucide-react";
import {
  CERTS_FORMATEUR,
  alertLevel, badgeClass, formatDate, daysUntil, daysLabel, shouldAlertTfpAps
} from "@/lib/certifications";
import { CERT_LABELS, certStatusBadge, daysUntilExpiry } from "@/lib/certificationUtils";
import type { CertType } from "@/types/certifications";

interface AlertItem {
  type: "formateur" | "stagiaire";
  id: string;
  name: string;
  cert: string;
  expiry: string;
  level: "expired" | "soon";
  days: number | null;
  carte_pro_number?: string | null;
}

interface CertRow {
  id: string;
  stagiaire_id: string;
  type: CertType;
  date_expiration: string;
  stagiaires: { id: string; first_name: string; last_name: string; email: string } | null;
}

export default function Rappels() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Certifications stagiaires tab state
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);
  const [certsError, setCertsError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterThreshold, setFilterThreshold] = useState<string>("all");

  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Rappels — SecureCRM";
    load();
    loadCerts();
  }, []);

  const load = async () => {
    setLoading(true);
    const all: AlertItem[] = [];

    const { data: formateurs } = await supabase.from("formateurs").select("*");
    (formateurs ?? []).forEach((f: any) => {
      CERTS_FORMATEUR.forEach((c) => {
        // Logique spéciale TFP APS : ignoré si MAC APS valide
        if (c.key === "tfp_aps") {
          if (!shouldAlertTfpAps(f.tfp_aps_expiry, f.mac_aps_expiry)) return;
          const days = daysUntil(f.tfp_aps_expiry);
          const lvl = alertLevel(f.tfp_aps_expiry);
          all.push({
            type: "formateur",
            id: f.id,
            name: `${f.first_name} ${f.last_name}`,
            cert: "TFP APS (MAC requis)",
            expiry: f.tfp_aps_expiry,
            level: lvl === "expired" ? "expired" : "soon",
            days,
            carte_pro_number: f.carte_pro_number,
          });
          return;
        }
        const lvl = alertLevel(f[c.date]);
        if (lvl === "expired" || lvl === "soon") {
          all.push({
            type: "formateur",
            id: f.id,
            name: `${f.first_name} ${f.last_name}`,
            cert: c.label,
            expiry: f[c.date],
            level: lvl,
            days: daysUntil(f[c.date]),
            carte_pro_number: f.carte_pro_number,
          });
        }
      });
    });

    const { data: stagiaires } = await supabase.from("stagiaires").select("*");
    (stagiaires ?? []).forEach((s: any) => {
      // Carte CNAPS
      const carteLevel = alertLevel(s.carte_pro_expiry);
      if (carteLevel === "expired" || carteLevel === "soon") {
        all.push({
          type: "stagiaire",
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          cert: "Carte CNAPS",
          expiry: s.carte_pro_expiry,
          level: carteLevel,
          days: daysUntil(s.carte_pro_expiry),
          carte_pro_number: s.carte_pro_number,
        });
      }
      // MAC APS
      const macLevel = alertLevel(s.mac_aps_expiry);
      if (macLevel === "expired" || macLevel === "soon") {
        all.push({
          type: "stagiaire",
          id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          cert: "MAC APS (5 ans)",
          expiry: s.mac_aps_expiry,
          level: macLevel,
          days: daysUntil(s.mac_aps_expiry),
          carte_pro_number: s.carte_pro_number,
        });
      }
    });

    all.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    setItems(all);
    setLoading(false);
  };

  const loadCerts = async () => {
    setCertsLoading(true);
    setCertsError(null);
    const { data, error } = await supabase
      .from("certifications")
      .select("*, stagiaires(id, first_name, last_name, email)")
      .order("date_expiration", { ascending: true });
    if (error) {
      setCertsError(error.message);
    } else {
      setCerts((data ?? []) as CertRow[]);
    }
    setCertsLoading(false);
  };

  const filteredCerts = certs.filter((cert) => {
    if (filterType !== "all" && cert.type !== filterType) return false;
    if (filterThreshold !== "all") {
      const days = daysUntilExpiry(cert.date_expiration) ?? -1;
      if (filterThreshold === "expired" && days >= 0) return false;
      if (filterThreshold === "lt30" && days >= 30) return false;
      if (filterThreshold === "lt90" && days >= 90) return false;
    }
    return true;
  });

  const filtered = items.filter((it) => {
    const q = search.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      it.cert.toLowerCase().includes(q) ||
      (it.carte_pro_number ?? "").toLowerCase().includes(q)
    );
  });

  const expired = filtered.filter((i) => i.level === "expired");
  const soon = filtered.filter((i) => i.level === "soon");
  const formateurs = filtered.filter((i) => i.type === "formateur");
  const stagiaires = filtered.filter((i) => i.type === "stagiaire");

  const summaryCards = [
    { label: "Expirés", value: items.filter(i => i.level === "expired").length, color: "text-destructive", bg: "border-destructive/30" },
    { label: "Moins de 60 jours", value: items.filter(i => i.level === "soon").length, color: "text-orange-400", bg: "border-orange-400/30" },
    { label: "Formateurs concernés", value: [...new Set(items.filter(i => i.type === "formateur").map(i => i.id))].length, color: "text-primary", bg: "border-primary/30" },
    { label: "Stagiaires concernés", value: [...new Set(items.filter(i => i.type === "stagiaire").map(i => i.id))].length, color: "text-primary", bg: "border-primary/30" },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Rappels et Alertes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Echéances à surveiller — cartes CNAPS et certifications formateurs
          </p>
        </div>
        <Badge variant="outline" className="border-destructive/40 text-destructive gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          {items.filter(i => i.level === "expired").length} expirés
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((s) => (
          <Card key={s.label} className={"p-4 bg-card/60 border " + s.bg}>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={"text-3xl font-display font-bold mt-1 " + s.color}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, certification, numéro de carte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/50"
        />
      </div>

      <Tabs defaultValue="tous">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="tous">Tous ({filtered.length})</TabsTrigger>
          <TabsTrigger value="expires">Expirés ({expired.length})</TabsTrigger>
          <TabsTrigger value="bientot">Bientôt ({soon.length})</TabsTrigger>
          <TabsTrigger value="formateurs">Formateurs ({formateurs.length})</TabsTrigger>
          <TabsTrigger value="stagiaires">Stagiaires ({stagiaires.length})</TabsTrigger>
          <TabsTrigger value="certifications">Certifications stagiaires</TabsTrigger>
        </TabsList>

        <TabsContent value="tous" className="mt-4">
          <AlertList items={filtered} loading={loading} />
        </TabsContent>
        <TabsContent value="expires" className="mt-4">
          <AlertList items={expired} loading={loading} />
        </TabsContent>
        <TabsContent value="bientot" className="mt-4">
          <AlertList items={soon} loading={loading} />
        </TabsContent>
        <TabsContent value="formateurs" className="mt-4">
          <AlertList items={formateurs} loading={loading} />
        </TabsContent>
        <TabsContent value="stagiaires" className="mt-4">
          <AlertList items={stagiaires} loading={loading} />
        </TabsContent>

        <TabsContent value="certifications" className="mt-4">
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {(Object.entries(CERT_LABELS) as [CertType, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterThreshold} onValueChange={setFilterThreshold}>
                <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                  <SelectItem value="lt30">&lt; 30j</SelectItem>
                  <SelectItem value="lt90">&lt; 90j</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            {certsLoading ? (
              <div className="space-y-2">
                <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
                <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
                <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
              </div>
            ) : certsError ? (
              <Card className="p-8 bg-card/60 border-border/50 text-center">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-destructive text-sm">{certsError}</p>
              </Card>
            ) : filteredCerts.length === 0 ? (
              <Card className="p-8 bg-card/60 border-border/50 text-center">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Aucune certification dans cette catégorie</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredCerts.map((cert) => {
                  const badge = certStatusBadge(cert.date_expiration);
                  const days = daysUntilExpiry(cert.date_expiration);
                  const dateFormatted = cert.date_expiration.split("-").reverse().join("/");
                  const stagiaireName = cert.stagiaires
                    ? `${cert.stagiaires.first_name} ${cert.stagiaires.last_name}`
                    : "—";
                  return (
                    <Card
                      key={cert.id}
                      onClick={() => navigate("/stagiaires")}
                      className="p-4 bg-card/60 border-border/50 hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{stagiaireName}</p>
                            <p className="text-xs text-muted-foreground">{CERT_LABELS[cert.type] ?? cert.type}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Expire le {dateFormatted}</p>
                            <p className="text-xs font-medium text-muted-foreground">
                              {days === null ? "—" : days < 0 ? `${Math.abs(days)}j dépassé` : `${days}j restants`}
                            </p>
                          </div>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertList({ items, loading }: { items: AlertItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
        <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
        <Card className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 bg-card/60 border-border/50 text-center">
        <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Aucune alerte dans cette catégorie</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <Card
          key={i}
          className={
            "p-4 bg-card/60 border-border/50 hover:border-primary/30 transition-all " +
            (it.level === "expired" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-orange-500")
          }
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className={
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 " +
                (it.type === "formateur" ? "bg-primary/10" : "bg-secondary")
              }>
                {it.type === "formateur"
                  ? <UserCheck className="h-4 w-4 text-primary" />
                  : <Users className="h-4 w-4 text-muted-foreground" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{it.name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground capitalize">{it.type}</p>
                  <span className="text-xs text-muted-foreground">·</span>
                  <p className="text-xs text-muted-foreground">{it.cert}</p>
                  {it.carte_pro_number && it.cert === "Carte CNAPS" && (
                    <span className="text-xs text-muted-foreground">
                      · <Shield className="h-3 w-3 inline" /> {it.carte_pro_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{formatDate(it.expiry)}</p>
                <p className={
                  "text-xs font-medium " +
                  (it.level === "expired" ? "text-destructive" : "text-orange-400")
                }>
                  {daysLabel(it.days)}
                </p>
              </div>
              <Badge className={badgeClass(it.level)}>
                {it.level === "expired" ? "Expiré" : "Bientôt"}
              </Badge>
              {it.cert === "Carte CNAPS" && (
                
                 < a href="https://www.cnaps-securite.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center hover:bg-primary/20 transition-colors"
                  title="Vérifier sur le portail CNAPS"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}