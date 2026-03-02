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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
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
  const [userOpen, setUserOpen] = useState(false);
  const [mealOpen, setMealOpen] = useState(false);

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

  const selectedUser = employees.find((u) => u.user_id === userId);
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

  const userFilterFn = (value: string, search: string) => {
    const user = employees.find((u) => u.user_id === value);
    if (!user) return 0;
    const s = search.toLowerCase();
    const haystack = [
      user.company_card_id || "",
      user.full_name || "",
      user.email || "",
    ].join(" ").toLowerCase();
    return haystack.includes(s) ? 1 : 0;
  };

  const mealFilterFn = (value: string, search: string) => {
    const meal = activeMeals.find((m) => m.id === value);
    if (!meal) return 0;
    const s = search.toLowerCase();
    const haystack = [meal.code || "", meal.name || ""].join(" ").toLowerCase();
    return haystack.includes(s) ? 1 : 0;
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
          {/* User - searchable */}
          <div className="space-y-1.5">
            <Label>Korisnik</Label>
            <Popover open={userOpen} onOpenChange={setUserOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userOpen}
                  disabled={isEdit}
                  className={cn(
                    "w-full justify-between font-normal",
                    !userId && "text-muted-foreground"
                  )}
                >
                  {selectedUser
                    ? `${selectedUser.full_name || selectedUser.email || "Nepoznat"}${selectedUser.company_card_id ? ` (${selectedUser.company_card_id})` : ""}`
                    : "Izaberite korisnika"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command filter={userFilterFn}>
                  <CommandInput placeholder="Pretraži po ID, imenu..." />
                  <CommandList>
                    <CommandEmpty>Nema rezultata.</CommandEmpty>
                    <CommandGroup>
                      {employees.map((u) => (
                        <CommandItem
                          key={u.user_id}
                          value={u.user_id}
                          onSelect={(val) => {
                            setUserId(val);
                            setUserOpen(false);
                          }}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", userId === u.user_id ? "opacity-100" : "opacity-0")}
                          />
                          <span className="truncate">
                            {u.full_name || u.email || "Nepoznat"}
                            {u.company_card_id ? ` (${u.company_card_id})` : ""}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

          {/* Meal - searchable */}
          <div className="space-y-1.5">
            <Label>Obrok</Label>
            <Popover open={mealOpen} onOpenChange={setMealOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={mealOpen}
                  className={cn(
                    "w-full justify-between font-normal",
                    !mealId && "text-muted-foreground"
                  )}
                >
                  {selectedMeal
                    ? `${selectedMeal.code ? `[${selectedMeal.code}] ` : ""}${selectedMeal.name} — ${Number(selectedMeal.price).toFixed(2)} RSD`
                    : "Izaberite obrok"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command filter={mealFilterFn}>
                  <CommandInput placeholder="Pretraži po šifri, nazivu..." />
                  <CommandList>
                    <CommandEmpty>Nema rezultata.</CommandEmpty>
                    <CommandGroup>
                      {activeMeals.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.id}
                          onSelect={(val) => {
                            setMealId(val);
                            setMealOpen(false);
                          }}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4", mealId === m.id ? "opacity-100" : "opacity-0")}
                          />
                          <span className="truncate">
                            {m.code ? `[${m.code}] ` : ""}{m.name} — {Number(m.price).toFixed(2)} RSD
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
