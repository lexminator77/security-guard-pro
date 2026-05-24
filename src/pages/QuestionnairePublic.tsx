import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONS, QUESTIONNAIRE_LABELS, type QuestionDef } from "@/lib/questionnaireQuestions";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type PageState = "loading" | "invalid" | "already_done" | "form" | "submitted";

interface TokenData {
  type: "positionnement" | "satisfaction_chaud" | "satisfaction_froid";
  formation_title: string;
  stagiaire_name: string;
}

function ScaleInput({ qid, value, onChange }: { qid: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(n))}
          className={`h-9 w-9 rounded-lg border text-sm font-medium transition-colors ${
            value === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function BooleanInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["oui", "non"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
            value === opt ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SelectInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${
            value === opt ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function QuestionnairePublic() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textDetails, setTextDetails] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Questionnaire — SecureCRM";
    fetch(`${SUPABASE_URL}/functions/v1/get-questionnaire-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 404) { setPageState("invalid"); return; }
        if (res.status === 409) { setPageState("already_done"); return; }
        if (!res.ok) { setPageState("invalid"); return; }
        const data = await res.json();
        setTokenData(data);
        setPageState("form");
      })
      .catch(() => setPageState("invalid"));
  }, [token]);

  const setAnswer = (qid: string, value: string) => setAnswers((prev) => ({ ...prev, [qid]: value }));

  const handleSubmit = async () => {
    if (!tokenData) return;
    const questions = QUESTIONS[tokenData.type];
    const reponses: Record<string, unknown> = {};
    for (const q of questions) {
      reponses[q.id] = answers[q.id] ?? null;
      if (q.type === "boolean_text" && answers[q.id] === "oui") {
        reponses[`${q.id}_detail`] = textDetails[q.id] ?? null;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ token, reponses }),
      });
      if (res.status === 409) { toast.error("Ce questionnaire a déjà été complété."); return; }
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Erreur"); return; }
      setPageState("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q: QuestionDef) => (
    <div key={q.id} className="space-y-2">
      <Label className="text-sm font-medium">{q.label}</Label>
      {q.type === "scale" && <ScaleInput qid={q.id} value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />}
      {q.type === "boolean" && <BooleanInput value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />}
      {q.type === "text" && (
        <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} rows={2} className="bg-background/60" />
      )}
      {q.type === "select" && q.options && (
        <SelectInput options={q.options} value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
      )}
      {q.type === "boolean_text" && (
        <div className="space-y-2">
          <BooleanInput value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
          {answers[q.id] === "oui" && (
            <Textarea
              placeholder="Précisez..."
              value={textDetails[q.id] ?? ""}
              onChange={(e) => setTextDetails((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={2}
              className="bg-background/60"
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">SecureCRM</span>
        </div>

        {pageState === "loading" && (
          <Card className="p-8 text-center bg-card/80 border-border/50">
            <p className="text-muted-foreground">Chargement du questionnaire…</p>
          </Card>
        )}

        {pageState === "invalid" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-destructive">Lien invalide ou expiré.</p>
            <p className="text-sm text-muted-foreground">Ce lien n'est pas valide ou a déjà été utilisé. Contactez votre centre de formation.</p>
          </Card>
        )}

        {pageState === "already_done" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-emerald-400">Questionnaire déjà rempli.</p>
            <p className="text-sm text-muted-foreground">Vous avez déjà répondu à ce questionnaire. Merci !</p>
          </Card>
        )}

        {pageState === "submitted" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-emerald-400">Merci pour vos réponses !</p>
            <p className="text-sm text-muted-foreground">Votre questionnaire a bien été enregistré.</p>
          </Card>
        )}

        {pageState === "form" && tokenData && (
          <Card className="p-6 bg-card/80 border-border/50 space-y-6">
            <div>
              <h1 className="text-xl font-display font-bold">
                {QUESTIONNAIRE_LABELS[tokenData.type]}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                <span>{tokenData.formation_title}</span>
                <span> · </span>
                <span>{tokenData.stagiaire_name}</span>
              </p>
            </div>

            <div className="space-y-6">
              {QUESTIONS[tokenData.type].map(renderQuestion)}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full gradient-primary text-primary-foreground shadow-glow"
            >
              {submitting ? "Envoi…" : "Envoyer mes réponses"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
