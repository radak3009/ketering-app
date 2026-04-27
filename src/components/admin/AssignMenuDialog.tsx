import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Loader2, X, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMenuTemplates } from "@/hooks/useMenuTemplates";
import { cn } from "@/lib/utils";
import type { MenuWithMeals } from "@/types/menu";

interface AssignMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeOrgTab: "proizvodnja" | "hogo";
  existingMenus: MenuWithMeals[];
  assignTemplate: (
    template: { id: string; name: string; description: string | null; organization_tag: string | null; meals?: Array<{ meal_id: string; quantity: number }> },
    dates: Date[]
  ) => Promise<void>;
}

export function AssignMenuDialog({
  open, onOpenChange, activeOrgTab, existingMenus, assignTemplate,
}: AssignMenuDialogProps) {
  const { toast } = useToast();
  const { templates, loading, refetch } = useMenuTemplates();

  // Refetch templates whenever the dialog opens to ensure freshness
  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const isProizvodnja = t.organization_tag === "Proizvodnja";
      return activeOrgTab === "proizvodnja" ? isProizvodnja : !isProizvodnja;
    });
  }, [templates, activeOrgTab]);

  const selectedTemplate = useMemo(
    () => filteredTemplates.find(t => t.id === selectedTemplateId),
    [filteredTemplates, selectedTemplateId]
  );

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    const dateStr = format(date, "yyyy-MM-dd");
    return existingMenus.some(m => m.menu_date === dateStr);
  };

  const reset = () => {
    setSelectedTemplateId("");
    setSelectedDates([]);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      toast({ title: "Greška", description: "Odaberite jelovnik", variant: "destructive" });
      return;
    }
    if (selectedDates.length === 0) {
      toast({ title: "Greška", description: "Odaberite bar jedan datum", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await assignTemplate(
        {
          id: selectedTemplate.id,
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          organization_tag: selectedTemplate.organization_tag,
          meals: selectedTemplate.meals?.map(m => ({ meal_id: m.meal_id, quantity: m.quantity })) || [],
        },
        selectedDates
      );
      reset();
      onOpenChange(false);
    } catch {
      // handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full md:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Dodela jelovnika ({activeOrgTab === "proizvodnja" ? "Proizvodnja" : "Hogo"})</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>Odaberi jelovnik *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? "Učitavanje..." : "-- Izaberi jelovnik --"}</option>
              {filteredTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {!loading && filteredTemplates.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Nema kreiranih jelovnika za ovu grupu. Kreirajte ih u tabu "Jelovnici".
              </p>
            )}
          </div>

          {selectedTemplate && (
            <div className="border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Obroci u jelovniku ({selectedTemplate.meals?.length || 0}):
              </p>
              <div className="flex flex-wrap gap-1">
                {selectedTemplate.meals?.map(m => (
                  <Badge key={m.id} variant="outline" className="text-xs">
                    {m.meal?.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Datumi za dodelu *
            </Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Klikom na datum dodajete ili uklanjate ga iz selekcije. Datumi sa već postojećim jelovnikom su onemogućeni.
            </p>
            <div className="border rounded-md flex justify-center">
              <CalendarComponent
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                disabled={isDateDisabled}
                className={cn("p-3 pointer-events-auto")}
              />
            </div>
          </div>

          {selectedDates.length > 0 && (
            <div>
              <Label>Izabrani datumi ({selectedDates.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[...selectedDates]
                  .sort((a, b) => a.getTime() - b.getTime())
                  .map(d => (
                    <Badge key={d.toISOString()} variant="secondary" className="gap-1">
                      {format(d, "dd.MM.yyyy")}
                      <button
                        type="button"
                        onClick={() => setSelectedDates(prev => prev.filter(x => x.getTime() !== d.getTime()))}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} className="flex-1" disabled={submitting || !selectedTemplate || selectedDates.length === 0}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Dodela u toku...</>
              ) : (
                `Dodeli na ${selectedDates.length} ${selectedDates.length === 1 ? "datum" : "datuma"}`
              )}
            </Button>
            <Button variant="outline" onClick={() => handleClose(false)}>Otkaži</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
