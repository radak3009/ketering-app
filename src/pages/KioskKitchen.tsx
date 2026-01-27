import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { kioskApi } from "@/services/kioskApi";
import { useKioskRealtime } from "@/hooks/useKioskRealtime";
import { 
  CheckCircle, 
  XCircle, 
  Undo2, 
  Trash2, 
  ChefHat,
  Clock,
  User,
  Wifi,
  WifiOff,
  RefreshCw
} from "lucide-react";
import type { QueueItem } from "@/types/kiosk";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function KioskKitchen() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") || "";
  
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<QueueItem | null>(null);

  const handleAuthError = useCallback(() => {
    setAuthorized(false);
  }, []);

  const {
    pending,
    served,
    loading,
    connectionStatus,
    isProcessing,
    setIsProcessing,
    setPending,
    setServed,
    refetch
  } = useKioskRealtime({
    token,
    onAuthError: handleAuthError
  });

  // Set authorized to true once we get data
  if (authorized === null && !loading && (pending.length > 0 || served.length > 0 || connectionStatus === 'connected')) {
    setAuthorized(true);
  }

  // Handle initial load - if loading completed without auth error, we're authorized
  if (authorized === null && !loading && connectionStatus !== 'disconnected') {
    setAuthorized(true);
  }

  const handleServe = async (item: QueueItem) => {
    setProcessingId(item.id);
    setIsProcessing(true);
    
    // Optimistic update
    setPending(prev => prev.filter(p => p.id !== item.id));
    setServed(prev => [{ ...item, status: 'served', served_at: new Date().toISOString() }, ...prev]);

    try {
      await kioskApi.serve(token, item.id);
      // Realtime will confirm the update, but fetch as backup
      await refetch();
    } catch (error) {
      console.error("Serve error:", error);
      await refetch();
    } finally {
      setProcessingId(null);
      setIsProcessing(false);
    }
  };

  const handleUndo = async (item: QueueItem) => {
    setProcessingId(item.id);
    setIsProcessing(true);
    
    // Optimistic update
    setServed(prev => prev.filter(s => s.id !== item.id));
    setPending(prev => [...prev, { ...item, status: 'pending', served_at: null }]);

    try {
      await kioskApi.undo(token, item.id);
      await refetch();
    } catch (error) {
      console.error("Undo error:", error);
      await refetch();
    } finally {
      setProcessingId(null);
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = (item: QueueItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    setProcessingId(itemToDelete.id);
    setIsProcessing(true);
    setDeleteDialogOpen(false);
    
    // Optimistic update
    setServed(prev => prev.filter(s => s.id !== itemToDelete.id));
    setPending(prev => prev.filter(p => p.id !== itemToDelete.id));

    try {
      await kioskApi.delete(token, itemToDelete.id);
      await refetch();
    } catch (error) {
      console.error("Delete error:", error);
      await refetch();
    } finally {
      setProcessingId(null);
      setIsProcessing(false);
      setItemToDelete(null);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "HH:mm");
    } catch {
      return "--:--";
    }
  };

  // Connection status indicator component
  const ConnectionIndicator = () => {
    if (connectionStatus === 'connected') {
      return (
        <div className="flex items-center gap-2 text-sm text-success">
          <Wifi className="h-4 w-4" />
          <span className="hidden sm:inline">Povezano</span>
        </div>
      );
    }
    
    if (connectionStatus === 'connecting') {
      return (
        <div className="flex items-center gap-2 text-sm text-warning">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Povezivanje...</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <WifiOff className="h-4 w-4" />
        <span className="hidden sm:inline">Sinhronizacija (45s)</span>
      </div>
    );
  };

  // Unauthorized screen
  if (authorized === false) {
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

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center">
        <LoadingSpinner size="xl" text="Učitavanje..." />
      </div>
    );
  }

  const today = format(new Date(), "dd.MM.yyyy.");

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">KUHINJA</h1>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionIndicator />
          <div className="text-muted-foreground">
            {today}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader className="pb-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="pending" className="text-base flex items-center justify-center gap-2">
                <span>Za izdavanje</span>
                {pending.length > 0 && (
                  <Badge variant="destructive">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="served" className="text-base flex items-center justify-center gap-2">
                <span>Izdato danas</span>
                {served.length > 0 && (
                  <Badge variant="secondary">
                    {served.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Pending Tab */}
            <TabsContent value="pending" className="mt-0">
              {pending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                  <p className="text-lg">Nema zahteva za izdavanje</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        index === 0 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                          {item.employee_identifier}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">
                              {item.fullName || "—"}
                            </span>
                          </div>
                          <p className="text-primary font-semibold truncate">
                            {item.meal_name_snapshot || "Nepoznat obrok"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Clock className="h-4 w-4" />
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                      <Button
                        size="lg"
                        variant="success"
                        onClick={() => handleServe(item)}
                        disabled={processingId === item.id}
                        className="ml-4 h-12 px-6"
                      >
                        {processingId === item.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Izdato
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Served Tab */}
            <TabsContent value="served" className="mt-0">
              {served.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">Još nije izdato nijedan obrok danas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {served.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-success/5 border-success/20"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="font-mono text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                          {item.employee_identifier}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">
                              {item.fullName || "—"}
                            </span>
                          </div>
                          <p className="text-success font-semibold truncate">
                            {item.meal_name_snapshot || "Nepoznat obrok"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-success text-sm">
                          <CheckCircle className="h-4 w-4" />
                          {item.served_at ? formatTime(item.served_at) : "--:--"}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => handleUndo(item)}
                          disabled={processingId === item.id}
                          className="h-12"
                        >
                          {processingId === item.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <Undo2 className="h-5 w-5 mr-2" />
                              Poništi
                            </>
                          )}
                        </Button>
                        <Button
                          size="lg"
                          variant="destructive"
                          onClick={() => handleDeleteClick(item)}
                          disabled={processingId === item.id}
                          className="h-12"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati zapis?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovaj zapis? Ova akcija se ne može poništiti.
              {itemToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p><strong>ID:</strong> {itemToDelete.employee_identifier}</p>
                  <p><strong>Obrok:</strong> {itemToDelete.meal_name_snapshot}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
