// @ts-nocheck
import { useRef, useEffect, useState } from "react";
import SignaturePad from "signature_pad";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SignatureModalProps {
  open: boolean;
  title: string;
  onConfirm: (signatureBase64: string) => Promise<void>;
  onClose: () => void;
}

export function SignatureModal({ open, title, onConfirm, onClose }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Attendre la fin de l'animation d'ouverture du Dialog avant de lire les dimensions
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Adapter la résolution interne du canvas à la taille CSS affichée + devicePixelRatio
      // Sans ça, sur mobile (DPR ≥ 2) les touches n'atterrissent pas au bon endroit
      const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);

      const pad = new SignaturePad(canvas, {
        penColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255, 255, 255)",
        minWidth: 1,
        maxWidth: 3,
      });
      padRef.current = pad;
    }, 150);

    return () => {
      clearTimeout(timer);
      if (padRef.current) {
        padRef.current.off();
        padRef.current = null;
      }
    };
  }, [open]);

  const handleConfirm = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("Veuillez signer avant de confirmer");
      return;
    }
    setConfirming(true);
    try {
      await onConfirm(pad.toDataURL("image/png"));
    } finally {
      setConfirming(false);
    }
  };

  const handleClear = () => {
    padRef.current?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border-2 border-border/50 rounded-lg overflow-hidden bg-white">
          {/* Pas de width/height HTML fixés — on lit offsetWidth après rendu et on scale avec DPR */}
          <canvas
            ref={canvasRef}
            className="touch-none w-full"
            style={{ height: "180px", display: "block" }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Signez dans le cadre ci-dessus avec votre doigt ou votre souris
        </p>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={handleClear}
            disabled={confirming}
          >
            Effacer
          </Button>
          <Button
            className="flex-1 min-h-[44px] gradient-primary text-primary-foreground"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? "Enregistrement…" : "Confirmer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
