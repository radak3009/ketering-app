import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "loading" | "success" | "error";

export default function AuthConfirm() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Verifikacioni token nije pronađen u linku.");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("confirm-email", {
          body: { token },
        });
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setMessage(error.message || "Greška pri potvrdi emaila.");
          return;
        }
        if (data?.success) {
          setStatus("success");
          setMessage(
            data.alreadyConfirmed
              ? "Vaš email je već potvrđen. Možete se prijaviti."
              : "Email je uspešno potvrđen! Sada se možete prijaviti."
          );
        } else {
          setStatus("error");
          setMessage(data?.error || "Nepoznata greška.");
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Neočekivana greška.");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary" />}
            {status === "success" && <CheckCircle2 className="h-12 w-12 text-primary" />}
            {status === "error" && <XCircle className="h-12 w-12 text-destructive" />}
          </div>
          <CardTitle>
            {status === "loading" && "Potvrđivanje emaila..."}
            {status === "success" && "Email potvrđen"}
            {status === "error" && "Potvrda nije uspela"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status !== "loading" && (
            <Link to="/auth">
              <Button>Idi na prijavu</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
