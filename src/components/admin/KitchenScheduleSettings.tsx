import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
import { Clock, CalendarIcon, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useKitchenSchedule, WeeklySchedule, ScheduleException } from "@/hooks/useKitchenSchedule";
import { format, parseISO } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function KitchenScheduleSettings() {
  const {
    weeklySchedule,
    exceptions,
    loading,
    saving,
    dayNames,
    updateWeeklySchedule,
    addException,
    deleteException,
    setWeeklySchedule,
  } = useKitchenSchedule();

  const [newException, setNewException] = useState<{
    date: Date | undefined;
    closedAllDay: boolean;
    openTime: string;
    closeTime: string;
    note: string;
  }>({
    date: undefined,
    closedAllDay: true,
    openTime: "06:00",
    closeTime: "22:00",
    note: "",
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] = useState<ScheduleException | null>(null);

  const handleScheduleChange = (dayOfWeek: number, field: keyof WeeklySchedule, value: any) => {
    setWeeklySchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSaveSchedule = () => {
    updateWeeklySchedule(weeklySchedule);
  };

  const handleAddException = async () => {
    if (!newException.date) return;

    await addException({
      date: format(newException.date, "yyyy-MM-dd"),
      closedAllDay: newException.closedAllDay,
      openTime: newException.closedAllDay ? null : newException.openTime,
      closeTime: newException.closedAllDay ? null : newException.closeTime,
      note: newException.note || null,
    });

    // Reset form
    setNewException({
      date: undefined,
      closedAllDay: true,
      openTime: "06:00",
      closeTime: "22:00",
      note: "",
    });
  };

  const handleDeleteClick = (exception: ScheduleException) => {
    setExceptionToDelete(exception);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (exceptionToDelete) {
      await deleteException(exceptionToDelete.id);
      setExceptionToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  // Reorder days to start with Monday (1) and end with Sunday (0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <LoadingSpinner size="lg" text="Učitavanje rasporeda..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Nedeljni raspored kuhinje
          </CardTitle>
          <CardDescription>
            Definišite radno vreme kuhinje za svaki dan u nedelji
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderedDays.map((dayOfWeek) => {
              const day = weeklySchedule.find((d) => d.dayOfWeek === dayOfWeek);
              if (!day) return null;

              return (
                <div
                  key={dayOfWeek}
                  className={cn(
                    "flex flex-wrap items-center gap-4 p-3 rounded-lg border",
                    day.enabled ? "bg-card" : "bg-muted/50"
                  )}
                >
                  <div className="w-28">
                    <span className="font-medium">{dayNames[dayOfWeek]}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(checked) =>
                        handleScheduleChange(dayOfWeek, "enabled", checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {day.enabled ? "Radi" : "Zatvoreno"}
                    </span>
                  </div>

                  {day.enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={day.openTime}
                        onChange={(e) =>
                          handleScheduleChange(dayOfWeek, "openTime", e.target.value)
                        }
                        className="w-28"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={day.closeTime}
                        onChange={(e) =>
                          handleScheduleChange(dayOfWeek, "closeTime", e.target.value)
                        }
                        className="w-28"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveSchedule} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Čuvanje...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sačuvaj raspored
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Izuzeci (praznici, posebni dani)
          </CardTitle>
          <CardDescription>
            Dodajte izuzetke za dane sa drugačijim radnim vremenom ili zatvorene dane
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add Exception Form */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newException.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newException.date
                        ? format(newException.date, "dd.MM.yyyy", { locale: sr })
                        : "Izaberite datum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newException.date}
                      onSelect={(date) => {
                        setNewException((prev) => ({ ...prev, date }));
                        setCalendarOpen(false);
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={newException.closedAllDay}
                    onCheckedChange={(checked) =>
                      setNewException((prev) => ({ ...prev, closedAllDay: checked }))
                    }
                  />
                  <span className="text-sm">
                    {newException.closedAllDay ? "Zatvoreno ceo dan" : "Posebno vreme"}
                  </span>
                </div>
              </div>

              {!newException.closedAllDay && (
                <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                  <Label>Radno vreme</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newException.openTime}
                      onChange={(e) =>
                        setNewException((prev) => ({ ...prev, openTime: e.target.value }))
                      }
                      className="w-28"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      value={newException.closeTime}
                      onChange={(e) =>
                        setNewException((prev) => ({ ...prev, closeTime: e.target.value }))
                      }
                      className="w-28"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Napomena (opciono)</Label>
              <Textarea
                value={newException.note}
                onChange={(e) =>
                  setNewException((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="npr. Državni praznik"
                className="resize-none"
                rows={2}
              />
            </div>

            <Button
              onClick={handleAddException}
              disabled={!newException.date || saving}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Dodaj izuzetak
            </Button>
          </div>

          {/* Exceptions List */}
          {exceptions.length > 0 && (
            <>
              <Separator className="my-6" />
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Aktivni izuzeci ({exceptions.length})
                </h4>
                {exceptions.map((exception) => (
                  <div
                    key={exception.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {format(parseISO(exception.date), "EEEE, dd.MM.yyyy", {
                            locale: sr,
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {exception.closedAllDay ? (
                            <Badge variant="destructive">Zatvoreno</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {exception.openTime} - {exception.closeTime}
                            </Badge>
                          )}
                          {exception.note && (
                            <span className="text-sm text-muted-foreground">
                              {exception.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(exception)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          {exceptions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nema definisanih izuzetaka</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati izuzetak?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovaj izuzetak?
              {exceptionToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p>
                    <strong>Datum:</strong>{" "}
                    {format(parseISO(exceptionToDelete.date), "dd.MM.yyyy", {
                      locale: sr,
                    })}
                  </p>
                  {exceptionToDelete.note && (
                    <p>
                      <strong>Napomena:</strong> {exceptionToDelete.note}
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
