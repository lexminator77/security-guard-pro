// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Pencil, Trash2, Search, Users, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Entreprise {
  id: string;
  nom: string;
  siret: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  contact_nom: string | null;
  contact_prenom: string | null;
  notes: string | null;
  created_at: string;
  _stagiaires_count?: number;
}

interface Stagiaire {
  id: string;
  first_name: string;
  last_name: string;
}

const EMPTY: Omit<Entreprise, "id" | "created_at" | "_stagiaires_count"> = {
  nom: "",
  siret: "",
  adresse: "",
  code_postal: "",
  ville: "",
  email: "",
  telephone: "",
  contact_nom: "",
  contact_prenom: "",
  notes: "",
};

function NomInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Nom de l'entreprise *</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex: EHPAD Les Pins" className="bg-secondary/50" />
    </div>
  );
}

function SiretInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>SIRET</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="12345678901234" className="bg-secondary/50" />
    </div>
  );
}

function EmailInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Email</Label>
      <Input type="email" value={value} onChange={(e) => onChange(e.target.value)} placeholder="contact@entreprise.fr" className="bg-secondary/50" />
    </div>
  );
}

function TelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Téléphone</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="06 00 00 00 00" className="bg-secondary/50" />
    </div>
  );
}

function AdresseInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Adresse</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="12 rue de la Paix" className="bg-secondary/50" />
    </div>
  );
}

function CPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Code postal</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="17000" className="bg-secondary/50" />
    </div>
  );
}

function VilleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Ville</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Royan" className="bg-secondary/50" />
    </div>
  );
}

function ContactNomInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Nom contact RH</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Dupont" className="bg-secondary/50" />
    </div>
  );
}

function ContactPrenomInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Prénom contact RH</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Marie" className="bg-secondary/50" />
    </div>
  );
}

function NotesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Notes</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Notes internes..." className="bg-secondary/50" />
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Rechercher une entreprise..." className="pl-9 bg-secondary/50 border-border/50" />
    </div>
  );
}

export default function Entreprises() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entreprise | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openStagiaires, setOpenStagiaires] = useState(false);
  const [selectedEntreprise, setSelectedEntreprise] = useState<Entreprise | null>(null);
  const [linkedStagiaires, setLinkedStagiaires] = useState<string[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    document.title = "Entreprises — SecureCRM";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: ents } = await supabase.from("entreprises").select("*").order("nom");
    const { data: links } = await supabase.from("entreprise_stagiaires").select("entreprise_id");
    const { data: stags } = await supabase.from("stagiaires").select("id, first_name, last_name").order("last_name");

    const counts: Record<string, number> = {};
    (links ?? []).forEach((l: any) => {
      counts[l.entreprise_id] = (counts[l.entreprise_id] ?? 0) + 1;
    });

    setEntreprises((ents ?? []).map((e: any) => ({ ...e, _stagiaires_count: counts[e.id] ?? 0 })));
    setStagiaires(stags ?? []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setOpen(true);
  };

  const openEdit = (e: Entreprise) => {
    setEditing(e);
    setForm({
      nom: e.nom ?? "",
      siret: e.siret ?? "",
      adresse: e.adresse ?? "",
      code_postal: e.code_postal ?? "",
      ville: e.ville ?? "",
      email: e.email ?? "",
      telephone: e.telephone ?? "",
      contact_nom: e.contact_nom ?? "",
      contact_prenom: e.contact_prenom ?? "",
      notes: e.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    const payload = {
      nom: form.nom.trim(),
      siret: form.siret || null,
      adresse: form.adresse || null,
      code_postal: form.code_postal || null,
      ville: form.ville || null,
      email: form.email || null,
      telephone: form.telephone || null,
      contact_nom: form.contact_nom || null,
      contact_prenom: form.contact_prenom || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from("entreprises").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erreur lors de la mise à jour"); return; }
      toast.success("Entreprise mise à jour");
    } else {
      const { error } = await supabase.from("entreprises").insert(payload);
      if (error) { toast.error("Erreur lors de la création"); return; }
      toast.success("Entreprise créée");
    }
    setOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("entreprises").delete().eq("id", deleteId);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    toast.success("Entreprise supprimée");
    setDeleteId(null);
    load();
  };

  const openGererStagiaires = async (e: Entreprise) => {
    setSelectedEntreprise(e);
    const { data } = await supabase.from("entreprise_stagiaires").select("stagiaire_id").eq("entreprise_id", e.id);
    setLinkedStagiaires((data ?? []).map((l: any) => l.stagiaire_id));
    setOpenStagiaires(true);
  };

  const toggleStagiaire = (id: string) => {
    setLinkedStagiaires((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const saveLinks = async () => {
    if (!selectedEntreprise) return;
    setSavingLinks(true);
    await supabase.from("entreprise_stagiaires").delete().eq("entreprise_id", selectedEntreprise.id);
    if (linkedStagiaires.length > 0) {
      await supabase.from("entreprise_stagiaires").insert(
        linkedStagiaires.map((sid) => ({ entreprise_id: selectedEntreprise.id, stagiaire_id: sid }))
      );
    }
    toast.success("Stagiaires mis à jour");
    setSavingLinks(false);
    setOpenStagiaires(false);
    load();
  };

  const filtered = entreprises.filter((e) =>
    e.nom.toLowerCase().includes(search.toLowerCase()) ||
    (e.ville ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (e.contact_nom ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Entreprises</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des clients entreprises</p>
        </div>
        <Button onClick={openCreate} className="gradient-primary shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle entreprise
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} />
        <Badge variant="outline" className="border-primary/30 text-primary px-3 py-2">
          <Building2 className="h-3 w-3 mr-1" /> {entreprises.length} entreprise{entreprises.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <Card className="bg-card/60 border-border/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aucune entreprise trouvée</p>
            <Button onClick={openCreate} variant="outline" className="mt-3">
              <Plus className="h-4 w-4 mr-2" /> Créer la première
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>Entreprise</TableHead>
                <TableHead>Contact RH</TableHead>
                <TableHead>Coordonnées</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Stagiaires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell>
                    <div>
                      <p className="font-medium">{e.nom}</p>
                      {e.siret && <p className="text-xs text-muted-foreground font-mono">{e.siret}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.contact_prenom || e.contact_nom
                      ? <p className="text-sm">{e.contact_prenom} {e.contact_nom}</p>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {e.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {e.email}
                        </div>
                      )}
                      {e.telephone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {e.telephone}
                        </div>
                      )}
                      {!e.email && !e.telephone && <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.ville
                      ? <div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{e.ville}</div>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openGererStagiaires(e)}
                      className="gap-1.5 text-xs"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {e._stagiaires_count} stagiaire{(e._stagiaires_count ?? 0) > 1 ? "s" : ""}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'entreprise" : "Nouvelle entreprise"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <NomInput value={form.nom} onChange={(v) => setForm(f => ({ ...f, nom: v }))} />
            <SiretInput value={form.siret ?? ""} onChange={(v) => setForm(f => ({ ...f, siret: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <ContactPrenomInput value={form.contact_prenom ?? ""} onChange={(v) => setForm(f => ({ ...f, contact_prenom: v }))} />
              <ContactNomInput value={form.contact_nom ?? ""} onChange={(v) => setForm(f => ({ ...f, contact_nom: v }))} />
            </div>
            <EmailInput value={form.email ?? ""} onChange={(v) => setForm(f => ({ ...f, email: v }))} />
            <TelInput value={form.telephone ?? ""} onChange={(v) => setForm(f => ({ ...f, telephone: v }))} />
            <AdresseInput value={form.adresse ?? ""} onChange={(v) => setForm(f => ({ ...f, adresse: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <CPInput value={form.code_postal ?? ""} onChange={(v) => setForm(f => ({ ...f, code_postal: v }))} />
              <VilleInput value={form.ville ?? ""} onChange={(v) => setForm(f => ({ ...f, ville: v }))} />
            </div>
            <NotesInput value={form.notes ?? ""} onChange={(v) => setForm(f => ({ ...f, notes: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} className="gradient-primary">
              {editing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Supprimer l'entreprise ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible. Les liens avec les stagiaires seront supprimés.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gestion stagiaires */}
      <Dialog open={openStagiaires} onOpenChange={setOpenStagiaires}>
        <DialogContent className="max-w-md bg-card border-border/50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stagiaires — {selectedEntreprise?.nom}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Sélectionne les stagiaires rattachés à cette entreprise.</p>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {stagiaires.map((s) => (
              <div
                key={s.id}
                onClick={() => toggleStagiaire(s.id)}
                className={"flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors " +
                  (linkedStagiaires.includes(s.id) ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary/50")}
              >
                <div className={"h-4 w-4 rounded border flex items-center justify-center shrink-0 " +
                  (linkedStagiaires.includes(s.id) ? "bg-primary border-primary" : "border-border")}>
                  {linkedStagiaires.includes(s.id) && <span className="text-primary-foreground text-xs">✓</span>}
                </div>
                <p className="text-sm">{s.first_name} {s.last_name}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenStagiaires(false)}>Annuler</Button>
            <Button onClick={saveLinks} className="gradient-primary" disabled={savingLinks}>
              {savingLinks ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}