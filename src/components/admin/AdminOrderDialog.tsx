import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import type { ProfileWithRole, Meal } from "@/types";

const SHIFTS = [
  { value: "prva", label: "I smena" },
  { value: "druga", label: "II smena" },
  { value: "treća", label: "III smena" },
];

export interface AdminOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: ProfileWithRole[];
  meals: Meal[];
  onSubmit: (data: {
    userId: string;
    deliveryDate: string;
    shift: string;
    mealId: string;
    mealPrice: number;
  }) => Promise<void>;
  // Edit mode
  editData?: {
    orderItemId: string;
    userId: string;
    deliveryDate: string;
    shift: string;
    mealId: string;
  } | null;
  onUpdate?: (data: {
    orderItemId: string;
    shift: string;
    mealId: string;
    mealPrice: number;
  }) => Promise<void>;
}

export function AdminOrderDialog({
  open, onOpenChange, users, meals, onSubmit, editData, onUpdate,
}: AdminOrderDialogProps) {
  const [userId, setUserId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>();
  const [shift, setShift] = useState("prva");
  const [mealId, setMealId] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        setUserId(editData.userId);
        setDeliveryDate(new Date(editData.deliveryDate + "T00:00:00"));
        setShift(editData.shift);
        setMealId(editData.mealId);
      } else {
        setUserId("");
        setDeliveryDate(undefined);
        setShift("prva");
        setMealId("");
      }
    }
  }, [open, editData]);

  const activeMeals = useMemo(
    () => meals.filter((m) => m.status === "aktivan" && m.is_available),
    [meals]
  );

  const employees = useMemo(
    () =>
      users
        .filter((u) => u.role === "employee")
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "sr")),
    [users]
  );

  const selectedMeal = meals.find((m) => m.id === mealId);

  const canSubmit = userId && deliveryDate && shift && mealId;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedMeal) return;
    setSaving(true);
    try {
      const dateStr = format(deliveryDate!, "yyyy-MM-dd");
      if (isEdit && onUpdate && editData) {
        await onUpdate({
          orderItemId: editData.orderItemId,
          shift,
          mealId,
          mealPrice: Number(selectedMeal.price),
        });
      } else {
        await onSubmit({
          userId,
          deliveryDate: dateStr,
          shift,
          mealId,
          mealPrice: Number(selectedMeal.price),
        });
      }
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Izmeni porudžbinu" : "Nova porudžbina"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Izmenite smenu ili obrok za stavku porudžbine."
              : "Kreirajte novu porudžbinu za zaposlenog."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User */}
          <div className="space-y-1.5">
            <Label>Korisnik</Label>
            <Select value={userId} onValueChange={setUserId} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite korisnika" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {employees.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.full_name || u.email || "Nepoznat"}{" "}
                    {u.company_card_id ? `(${u.company_card_id})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Datum dostave</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isEdit}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deliveryDate
                    ? format(deliveryDate, "PPP", { locale: sr })
                    : "Izaberite datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deliveryDate}
                  onSelect={setDeliveryDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Shift */}
          <div className="space-y-1.5">
            <Label>Smena</Label>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meal */}
          <div className="space-y-1.5">
            <Label>Obrok</Label>
            <Select value={mealId} onValueChange={setMealId}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite obrok" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {activeMeals.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} — {Number(m.price).toFixed(2)} RSD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Otkaži
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Čuvanje..." : isEdit ? "Sačuvaj izmene" : "Kreiraj porudžbinu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
