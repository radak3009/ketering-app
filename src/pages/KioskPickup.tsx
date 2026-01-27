import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { kioskApi } from "@/services/kioskApi";
import { CheckCircle, XCircle, AlertCircle, Utensils, UserCheck } from "lucide-react";
import type { ShowMealResponse } from "@/types/kiosk";

type ScreenState = 
  | "input" 
  | "loading" 
  | "success" 
  | "confirm" 
  | "confirming" 
  | "confirmed" 
  | "error" 
  | "already-served" 
  | "unauthorized";

export default function KioskPickup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";
  
  const [screenState, setScreenState] = useState<ScreenState>(token ? "input" : "unauthorized");
  const [cardId, setCardId] = useState("");
  const [result, setResult] = useState<ShowMealResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [countdown, setCountdown] = useState(8);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus input on mount and after reset
  useEffect(() => {
    if (screenState === "input" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [screenState]);

  // Handle auto-reset countdown for success/already-served/confirmed screens
  useEffect(() => {
    if (screenState === "success" || screenState === "already-served" || screenState === "confirmed") {
      setCountdown(8);
      
      countdownRef.current = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        handleReset();
      }, 8000);

      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [screenState]);

  // Handle auto-reset for confirm screen (8 seconds timeout = auto-cancel)
  useEffect(() => {
    if (screenState === "confirm") {
      setCountdown(8);
      
      countdownRef.current = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        handleReset();
      }, 8000);

      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [screenState]);

  // Handle auto-reset for error screen (3 seconds)
  useEffect(() => {
    if (screenState === "error") {
      timeoutRef.current = setTimeout(() => {
        handleReset();
      }, 3000);

      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [screenState]);

  const handleReset = () => {
    setCardId("");
    setResult(null);
    setErrorMessage("");
    setScreenState("input");
    setCountdown(8);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardId.trim()) {
      setErrorMessage("Unesite ID");
      return;
    }

    setScreenState("loading");
    setErrorMessage("");

    try {
      const response = await kioskApi.showMeal(token, cardId.trim());
      setResult(response);

      if (response.alreadyServed) {
        setScreenState("already-served");
      } else if (response.found) {
        // Check if confirmation is required (kitchen is closed)
        if (response.confirmationRequired) {
          setScreenState("confirm");
        } else {
          // Kitchen is open - just show info, pickup at counter
          setScreenState("success");
        }
      } else {
        setErrorMessage(response.message || "Nema porudžbine za danas");
        setScreenState("error");
      }
    } catch (error) {
      console.error("Kiosk error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Greška pri povezivanju");
      setScreenState("error");
    }
  };

  const handleConfirmPickup = async () => {
    if (!result?.pickupRequestId) return;
    
    // Clear the auto-reset timeout
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    setScreenState("confirming");

    try {
      await kioskApi.confirmPickup(token, result.pickupRequestId);
      setScreenState("confirmed");
    } catch (error) {
      console.error("Confirm error:", error);
      const message = error instanceof Error ? error.message : "Greška pri potvrdi";
      
      // If kitchen is now open, show specific message
      if (message.includes("Kuhinja radi")) {
        setErrorMessage("Kuhinja sada radi - preuzmite obrok na šalteru");
      } else {
        setErrorMessage(message);
      }
      setScreenState("error");
    }
  };

  // Unauthorized screen
  if (screenState === "unauthorized") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/10 via-background to-destructive/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-destructive mb-2">Nedozvoljen pristup</h1>
            <p className="text-muted-foreground">Token za pristup nije validan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      {/* Input Screen */}
      {screenState === "input" && (
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 pb-8">
            <div className="text-center mb-8">
              <Utensils className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-foreground">KETERING</h1>
              <p className="text-muted-foreground mt-2">Unesite svoj ID za prikaz obroka</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  ref={inputRef}
                  type="text"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  placeholder="Unesite ID"
                  className="text-center text-2xl h-16 font-mono"
                  autoComplete="off"
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full h-14 text-lg"
              >
                PRIKAŽI OBROK
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Loading Screen */}
      {screenState === "loading" && (
        <Card className="w-full max-w-lg">
          <CardContent className="pt-12 pb-12">
            <LoadingSpinner size="xl" text="Učitavanje..." />
          </CardContent>
        </Card>
      )}

      {/* Confirming Screen */}
      {screenState === "confirming" && (
        <Card className="w-full max-w-lg">
          <CardContent className="pt-12 pb-12">
            <LoadingSpinner size="xl" text="Potvrđivanje preuzimanja..." />
          </CardContent>
        </Card>
      )}

      {/* Success Screen (Kitchen is open - pickup at counter) */}
      {screenState === "success" && result && (
        <Card className="w-full max-w-lg border-success/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-success mb-6">OBROK PRONAĐEN</h1>
              
              {result.fullName && (
                <p className="text-2xl font-semibold text-foreground mb-4">
                  {result.fullName}
                </p>
              )}
              
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Današnji obrok:</p>
                <p className="text-xl font-bold text-primary">
                  {result.mealName}
                </p>
                <p className="text-sm text-success mt-2">
                  Preuzmite obrok na šalteru kuhinje
                </p>
              </div>

              <Button 
                onClick={handleReset}
                size="lg"
                variant="outline"
                className="w-full h-12"
              >
                ZATVORI
              </Button>

              <p className="text-sm text-muted-foreground mt-4">
                Automatsko zatvaranje za {countdown}s
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Screen (Kitchen is closed - self-service confirmation) */}
      {screenState === "confirm" && result && (
        <Card className="w-full max-w-lg border-warning/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <AlertCircle className="h-20 w-20 text-warning mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-warning mb-4">POTVRDA PREUZIMANJA</h1>
              
              {result.fullName && (
                <p className="text-2xl font-semibold text-foreground mb-2">
                  {result.fullName}
                </p>
              )}
              
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Obrok:</p>
                <p className="text-xl font-bold text-primary">
                  {result.mealName}
                </p>
              </div>

              <p className="text-muted-foreground mb-6">
                Potvrđujete preuzimanje obroka?
              </p>

              <div className="flex gap-4">
                <Button 
                  onClick={handleReset}
                  size="lg"
                  variant="outline"
                  className="flex-1 h-14"
                >
                  ODUSTANI
                </Button>
                <Button 
                  onClick={handleConfirmPickup}
                  size="lg"
                  className="flex-1 h-14 bg-success hover:bg-success/90"
                >
                  <UserCheck className="h-5 w-5 mr-2" />
                  DA, PREUZIMAM
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Automatski odustanak za {countdown}s
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmed Screen (Self-service confirmation successful) */}
      {screenState === "confirmed" && result && (
        <Card className="w-full max-w-lg border-success/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-success mb-6">PREUZIMANJE POTVRĐENO</h1>
              
              {result.fullName && (
                <p className="text-2xl font-semibold text-foreground mb-4">
                  {result.fullName}
                </p>
              )}
              
              <div className="bg-success/10 rounded-lg p-4 mb-6 border border-success/30">
                <p className="text-sm text-success mb-1">Obrok preuzet:</p>
                <p className="text-xl font-bold text-success">
                  {result.mealName}
                </p>
              </div>

              <Button 
                onClick={handleReset}
                size="lg"
                variant="outline"
                className="w-full h-12"
              >
                ZATVORI
              </Button>

              <p className="text-sm text-muted-foreground mt-4">
                Automatsko zatvaranje za {countdown}s
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Served Screen */}
      {screenState === "already-served" && result && (
        <Card className="w-full max-w-lg border-warning/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <AlertCircle className="h-20 w-20 text-warning mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-warning mb-6">VEĆ PREUZETO</h1>
              
              {result.fullName && (
                <p className="text-2xl font-semibold text-foreground mb-4">
                  {result.fullName}
                </p>
              )}
              
              <div className="bg-muted rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Obrok:</p>
                <p className="text-xl font-bold text-primary">
                  {result.mealName}
                </p>
                <p className="text-sm text-warning mt-2">
                  Ovaj obrok je već izdat danas.
                </p>
              </div>

              <Button 
                onClick={handleReset}
                size="lg"
                variant="outline"
                className="w-full h-12"
              >
                ZATVORI
              </Button>

              <p className="text-sm text-muted-foreground mt-4">
                Automatsko zatvaranje za {countdown}s
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Screen */}
      {screenState === "error" && (
        <Card className="w-full max-w-lg border-destructive/50">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <XCircle className="h-20 w-20 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-destructive mb-4">
                {errorMessage || "Greška"}
              </h1>
              
              <Button 
                onClick={handleReset}
                size="lg"
                variant="outline"
                className="w-full h-12"
              >
                POKUŠAJ PONOVO
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
