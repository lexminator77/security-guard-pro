import { useRef, useEffect } from "react";
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

  const getPad = (): SignaturePad | null => {
    if (padRef.current) return padRef.current;
    if (canvasRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        penColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255, 255, 255)",
      });
      padRef.current = pad;
      return pad;
    }
    return null;
  };

  useEffect(() => {
    if (open && canvasRef.current) {
      padRef.current = new SignaturePad(canvasRef.current, {
        penColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255, 255, 255)",
      });
      const pad = padRef.current;
      return () => {
        pad.off();
        padRef.current = null;
      };
    }
  }, [open]);

  const handleConfirm = async () => {
    const pad = getPad();
    if (!pad || pad.isEmpty()) {
      toast.error("Veuillez signer avant de confirmer");
      return;
    }
    await onConfirm(pad.toDataURL("image/png"));
  };

  const handleClear = () => {
    getPad()?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border-2 border-border/50 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={460}
            height={180}
            className="w-full touch-none"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Signez dans le cadre blanc ci-dessus
        </p>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={handleClear}
          >
            Effacer
          </Button>
          <Button
            className="flex-1 min-h-[44px] gradient-primary text-primary-foreground"
            onClick={handleConfirm}
          >
            Confirmer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
