import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Certification, CertType } from "@/types/certifications";
import {
  CERT_LABELS,
  certStatusBadge,
  calcDateExpiration,
  formatDateFr,
} from "@/lib/certificationUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2 } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CertificationsTabProps {
  stagiaireId: string;
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  type: CertType;
  date_obtention: string;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  type: "sst",
  date_obtention: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CertificationsTab({ stagiaireId }: CertificationsTabProps) {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchCerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("certifications")
      .select("*")
      .eq("stagiaire_id", stagiaireId);
    if (!error && data) {
      setCerts(data as Certification[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stagiaireId]);

  // ── Computed expiration ───────────────────────────────────────────────────

  const computedExpiration =
    form.date_obtention && form.type
      ? calcDateExpiration(form.date_obtention, form.type)
      : null;

  // ── Open add dialog ───────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  // ── Open edit dialog ──────────────────────────────────────────────────────

  const openEdit = (cert: Certification) => {
    setEditingId(cert.id);
    setForm({
      type: cert.type,
      date_obtention: cert.date_obtention,
      notes: cert.notes ?? "",
    });
    setDialogOpen(true);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date_obtention) return;

    const date_expiration = calcDateExpiration(form.date_obtention, form.type);

    if (editingId) {
      // Edit: UPDATE
      await supabase
        .from("certifications")
        .update({
          type: form.type,
          date_obtention: form.date_obtention,
          date_expiration,
          notes: form.notes || null,
        })
        .eq("id", editingId);
    } else {
      // Add: UPSERT (handles duplicate stagiaire+type)
      await supabase.from("certifications").upsert(
        {
          stagiaire_id: stagiaireId,
          type: form.type,
          date_obtention: form.date_obtention,
          date_expiration,
          source: "manuel",
          notes: form.notes || null,
        },
        { onConflict: "stagiaire_id,type" }
      );
    }

    setDialogOpen(false);
    await fetchCerts();
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (cert: Certification) => {
    if (!window.confirm(`Supprimer la certification ${CERT_LABELS[cert.type]} ?`)) return;
    await supabase.from("certifications").delete().eq("id", cert.id);
    await fetchCerts();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Certifications
        </h3>
        <Button size="sm" onClick={openAdd}>
          Ajouter une certification externe
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
      ) : certs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Aucune certification
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Date obtention</TableHead>
              <TableHead>Expire le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certs.map((cert) => {
              const badge = certStatusBadge(cert.date_expiration);
              return (
                <TableRow key={cert.id}>
                  <TableCell className="font-medium">
                    {CERT_LABELS[cert.type] ?? cert.type}
                  </TableCell>
                  <TableCell>{formatDateFr(cert.date_obtention)}</TableCell>
                  <TableCell>{formatDateFr(cert.date_expiration)}</TableCell>
                  <TableCell>
                    <Badge className={badge.className}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {cert.source === "auto" ? "Automatique" : "Manuel"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Modifier"
                        onClick={() => openEdit(cert)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer"
                        onClick={() => handleDelete(cert)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier la certification" : "Ajouter une certification"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="cert-type">Type de certification</Label>
              <Select
                value={form.type}
                onValueChange={(val) =>
                  setForm((f) => ({ ...f, type: val as CertType }))
                }
              >
                <SelectTrigger id="cert-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CERT_LABELS) as [CertType, string][]).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Date obtention */}
            <div className="space-y-1.5">
              <Label htmlFor="cert-date">Date d'obtention</Label>
              <Input
                id="cert-date"
                type="date"
                value={form.date_obtention}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date_obtention: e.target.value }))
                }
                required
              />
              {/* Computed expiration */}
              {computedExpiration && (
                <p className="text-xs text-muted-foreground">
                  Expire le :{" "}
                  {new Date(computedExpiration).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="cert-notes">Notes (optionnel)</Label>
              <Textarea
                id="cert-notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="Remarques éventuelles…"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
