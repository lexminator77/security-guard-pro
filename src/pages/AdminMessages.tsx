// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquare, Search, ChevronLeft, Clock } from "lucide-react";
 
export default function AdminMessages() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [q, setQ] = useState("");
 
  useEffect(() => {
    document.title = "Messagerie — SecureCRM";
    loadConversations();
  }, []);
 
  const loadConversations = async () => {
    // Récupérer tous les messages
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
 
    if (error) { console.error(error); return; }
    if (!msgs || msgs.length === 0) return;
 
    // Récupérer tous les stagiaires et formateurs séparément
    const stagiaireIds = [...new Set(msgs.map((m: any) => m.a_stagiaire_id).filter(Boolean))];
    const formateurIds = [...new Set(msgs.map((m: any) => m.de_formateur_id).filter(Boolean))];
 
    const [{ data: stagiaires }, { data: formateurs }] = await Promise.all([
      stagiaireIds.length > 0
        ? supabase.from("stagiaires").select("id, first_name, last_name").in("id", stagiaireIds)
        : Promise.resolve({ data: [] }),
      formateurIds.length > 0
        ? supabase.from("formateurs").select("id, first_name, last_name").in("id", formateurIds)
        : Promise.resolve({ data: [] }),
    ]);
 
    const stagiairesMap: Record<string, any> = {};
    (stagiaires ?? []).forEach((s: any) => { stagiairesMap[s.id] = s; });
 
    const formateursMap: Record<string, any> = {};
    (formateurs ?? []).forEach((f: any) => { formateursMap[f.id] = f; });
 
    // Grouper par stagiaire
    const grouped: Record<string, any> = {};
    msgs.forEach((m: any) => {
      const sid = m.a_stagiaire_id;
      if (!sid) return;
      if (!grouped[sid]) {
        grouped[sid] = {
          stagiaireId: sid,
          stagiaire: stagiairesMap[sid] ?? null,
          formateur: null,
          dernierMessage: m,
          total: 0,
        };
      }
      grouped[sid].total++;
      // Associer le formateur dès qu'on en trouve un
      if (m.de_formateur_id && !grouped[sid].formateur) {
        grouped[sid].formateur = formateursMap[m.de_formateur_id] ?? null;
      }
    });
 
    setConversations(Object.values(grouped));
  };
 
  const openConversation = async (conv: any) => {
    setSelected(conv);
 
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("a_stagiaire_id", conv.stagiaireId)
      .order("created_at");
 
    if (!msgs) { setMessages([]); return; }
 
    // Enrichir avec les noms formateurs
    const formateurIds = [...new Set(msgs.map((m: any) => m.de_formateur_id).filter(Boolean))];
    let formateursMap: Record<string, any> = {};
    if (formateurIds.length > 0) {
      const { data: formateurs } = await supabase
        .from("formateurs")
        .select("id, first_name, last_name")
        .in("id", formateurIds);
      (formateurs ?? []).forEach((f: any) => { formateursMap[f.id] = f; });
    }
 
    setMessages(msgs.map((m: any) => ({
      ...m,
      formateur: m.de_formateur_id ? formateursMap[m.de_formateur_id] : null,
    })));
  };
 
  const formatDateTime = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
 
  const filtered = conversations.filter((c) =>
    !q || `${c.stagiaire?.first_name ?? ""} ${c.stagiaire?.last_name ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );
 
  // Vue détail conversation
  if (selected) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold">
            {selected.stagiaire?.first_name} {selected.stagiaire?.last_name}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">{messages.length} message(s)</p>
        </div>
 
        <Card className="p-6 bg-card/60 border-border/50 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun message</p>
          ) : messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.de_formateur_id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] p-3 rounded-lg text-sm ${m.de_formateur_id
                ? "bg-primary/20 border border-primary/30"
                : "bg-muted/40 border border-border/50"}`}>
                <p className="text-[10px] font-medium opacity-60 mb-1">
                  {m.de_formateur_id
                    ? `Formateur — ${m.formateur?.first_name ?? ""} ${m.formateur?.last_name ?? ""}`
                    : "Stagiaire"}
                </p>
                <p>{m.contenu}</p>
                <p className="text-[10px] text-muted-foreground mt-1 text-right flex items-center justify-end gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }
 
  // Vue liste conversations
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
          <MessageSquare className="h-7 w-7 text-primary" /> Messagerie
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Consultation des échanges formateurs / stagiaires — lecture seule</p>
      </div>
 
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un stagiaire..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Card className="px-4 py-2 bg-primary/10 border-primary/30 text-center">
          <p className="text-lg font-bold text-primary">{conversations.length}</p>
          <p className="text-[10px] text-muted-foreground">conversation(s)</p>
        </Card>
      </div>
 
      <Card className="bg-card/60 border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <th className="pb-3 px-4 pt-4">Stagiaire</th>
              <th className="pb-3 px-4 pt-4">Formateur</th>
              <th className="pb-3 px-4 pt-4">Messages</th>
              <th className="pb-3 px-4 pt-4">Dernier message</th>
              <th className="pb-3 px-4 pt-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Aucune conversation</td></tr>
            )}
            {filtered.map((c: any) => (
              <tr key={c.stagiaireId} className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openConversation(c)}>
                <td className="py-3 px-4 font-medium">
                  {c.stagiaire?.first_name} {c.stagiaire?.last_name}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {c.formateur ? `${c.formateur.first_name} ${c.formateur.last_name}` : "—"}
                </td>
                <td className="py-3 px-4">
                  <Badge variant="outline" className="border-primary/30 text-primary">{c.total} message(s)</Badge>
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  {c.dernierMessage?.created_at ? formatDateTime(c.dernierMessage.created_at) : "—"}
                </td>
                <td className="py-3 px-4 text-right text-xs text-primary hover:underline">Voir →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}