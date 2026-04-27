import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Plus, Pencil, Trash2, Loader2, ImageIcon, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { useMenuTemplates } from "@/hooks/useMenuTemplates";
import type { MenuTemplateWithMeals } from "@/types/menu";
import { z } from "zod";

const templateSchema = z.object({
  name: z.string().trim().min(1, "Naziv je obavezan").max(100, "Naziv može imati najviše 100 karaktera"),
});

type FormState = {
  name: string;
  description: string;
  organization_tag: "Proizvodnja" | "Hogo";
  status: "aktivan" | "neaktivan";
  selectedMeals: string[];
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  organization_tag: "Hogo",
  status: "aktivan",
  selectedMeals: [],
});

export function MenuTemplatesTab() {
  const { toast } = useToast();
  const { meals } = useMeals();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useMenuTemplates();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [shiftFilter, setShiftFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  const [editing, setEditing] = useState<MenuTemplateWithMeals | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [updating, setUpdating] = useState(false);

  const [mealSearch, setMealSearch] = useState("");
  const [mealGroupFilter, setMealGroupFilter] = useState("");
  const [mealShiftFilter, setMealShiftFilter] = useState("");

  const filteredTemplates = useMemo(() => {
    const term = search.toLowerCase().trim();
    return templates.filter(t => {
      if (term && !t.name.toLowerCase().includes(term)) return false;
      if (groupFilter) {
        const tplGroup = t.organization_tag === "Proizvodnja" ? "Proizvodnja" : "Hogo";
        if (tplGroup !== groupFilter) return false;
      }
      if (shiftFilter) {
        const hasShift = t.meals?.some(m => m.meal?.shifts?.includes(shiftFilter));
        if (!hasShift) return false;
      }
      if (statusFilter) {
        const tplStatus = (t as any).status || "aktivan";
        if (tplStatus !== statusFilter) return false;
      }
      return true;
    });
  }, [templates, search, groupFilter, shiftFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredTemplates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getMealsForGroup = (group: "Proizvodnja" | "Hogo") => {
    return meals.filter(meal => {
      if (meal.status !== "aktivan") return false;
      const hasProizvodnja = meal.allowed_tags?.includes("Proizvodnja");
      return group === "Proizvodnja" ? hasProizvodnja : !hasProizvodnja;
    });
  };

  const renderMealPicker = (
    selectedGroup: "Proizvodnja" | "Hogo",
    selectedIds: string[],
    onToggle: (id: string, checked: boolean) => void
  ) => {
    const groupMeals = getMealsForGroup(selectedGroup);
    const mealGroups = [...new Set(groupMeals.map(m => m.meal_group).filter(Boolean))].sort();
    const filtered = groupMeals.filter(meal =>
      meal.name.toLowerCase().includes(mealSearch.toLowerCase()) &&
      (!mealGroupFilter || meal.meal_group === mealGroupFilter) &&
      (!mealShiftFilter || meal.shifts?.includes(mealShiftFilter))
    );
    const sorted = [...filtered].sort((a, b) => {
      const aSel = selectedIds.includes(a.id);
      const bSel = selectedIds.includes(b.id);
      if (aSel === bSel) return 0;
      return aSel ? -1 : 1;
    });

    return (
      <>
        <div>
          <Label>Pretraži obroke</Label>
          <Input
            placeholder="Pretraži po nazivu..."
            value={mealSearch}
            onChange={e => setMealSearch(e.target.value)}
          />
        </div>
        <div>
          <Label>Filtriraj po grupi obroka</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            value={mealGroupFilter}
            onChange={e => setMealGroupFilter(e.target.value)}
          >
            <option value="">Sve grupe</option>
            {mealGroups.map(g => <option key={g} value={g!}>{g}</option>)}
          </select>
        </div>
        <div>
          <Label>Filtriraj po smeni</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            value={mealShiftFilter}
            onChange={e => setMealShiftFilter(e.target.value)}
          >
            <option value="">Sve smene</option>
            <option value="prva">I smena</option>
            <option value="druga">II smena</option>
            <option value="treća">III smena</option>
          </select>
        </div>
        <div>
          <Label>Odaberi obroke</Label>
          <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
            {sorted.map(meal => (
              <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                <Checkbox
                  id={`tpl-meal-${meal.id}`}
                  checked={selectedIds.includes(meal.id)}
                  onCheckedChange={c => onToggle(meal.id, !!c)}
                />
                <div className="w-8 h-8 rounded overflow-hidden bg-muted mr-2">
                  {meal.image_url ? (
                    <img src={meal.image_url} alt={meal.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label htmlFor={`tpl-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                    {meal.name}
                  </label>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {meal.shifts?.map(s => (
                      <Badge key={s} variant="outline" className="text-[10px] px-1.5 py-0">
                        {s === "prva" ? "I" : s === "druga" ? "II" : s === "treća" ? "III" : s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Nema dostupnih obroka</p>
            )}
          </div>
        </div>
      </>
    );
  };

  const resetMealFilters = () => {
    setMealSearch("");
    setMealGroupFilter("");
    setMealShiftFilter("");
  };

  const handleCreate = async () => {
    const parsed = templateSchema.safeParse({ name: form.name });
    if (!parsed.success) {
      toast({ title: "Greška", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (form.selectedMeals.length === 0) {
      toast({ title: "Greška", description: "Odaberite bar jedan obrok", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await createTemplate({
        name: form.name.trim(),
        description: form.description.trim() || null,
        organization_tag: form.organization_tag === "Proizvodnja" ? "Proizvodnja" : null,
        meal_ids: form.selectedMeals,
      });
      setForm(emptyForm());
      resetMealFilters();
      setCreateOpen(false);
    } catch {
      // error handled in hook
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (tpl: MenuTemplateWithMeals) => {
    setEditing(tpl);
    setEditForm({
      name: tpl.name,
      description: tpl.description || "",
      organization_tag: tpl.organization_tag === "Proizvodnja" ? "Proizvodnja" : "Hogo",
      status: ((tpl as any).status === "neaktivan" ? "neaktivan" : "aktivan"),
      selectedMeals: tpl.meals?.map(m => m.meal_id) || [],
    });
    resetMealFilters();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const parsed = templateSchema.safeParse({ name: editForm.name });
    if (!parsed.success) {
      toast({ title: "Greška", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (editForm.selectedMeals.length === 0) {
      toast({ title: "Greška", description: "Odaberite bar jedan obrok", variant: "destructive" });
      return;
    }
    setUpdating(true);
    try {
      await updateTemplate(editing.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        organization_tag: editForm.organization_tag === "Proizvodnja" ? "Proizvodnja" : null,
        status: editForm.status,
        meal_ids: editForm.selectedMeals,
      });
      setEditing(null);
    } catch {
      // handled
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraga po nazivu..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8"
            />
          </div>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={groupFilter}
            onChange={e => { setGroupFilter(e.target.value); setPage(1); }}
          >
            <option value="">Sve grupe</option>
            <option value="Proizvodnja">Proizvodnja</option>
            <option value="Hogo">Hogo</option>
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={shiftFilter}
            onChange={e => { setShiftFilter(e.target.value); setPage(1); }}
          >
            <option value="">Sve smene</option>
            <option value="prva">I smena</option>
            <option value="druga">II smena</option>
            <option value="treća">III smena</option>
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Svi statusi</option>
            <option value="aktivan">Aktivan</option>
            <option value="neaktivan">Neaktivan</option>
          </select>
        </div>

        <Sheet open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setForm(emptyForm()); resetMealFilters(); } }}>
          <SheetTrigger asChild>
            <Button className="w-full md:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Kreiraj jelovnik
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full md:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Kreiraj novi jelovnik</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="tpl-name">Naziv jelovnika *</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="npr. Standardni Hogo meni"
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Grupa</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  value={form.organization_tag}
                  onChange={e => setForm({ ...form, organization_tag: e.target.value as "Proizvodnja" | "Hogo", selectedMeals: [] })}
                >
                  <option value="Hogo">Hogo</option>
                  <option value="Proizvodnja">Proizvodnja</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tpl-desc">Opis (opciono)</Label>
                <Textarea
                  id="tpl-desc"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Kratak opis..."
                />
              </div>
              {renderMealPicker(
                form.organization_tag,
                form.selectedMeals,
                (id, checked) => setForm(f => ({
                  ...f,
                  selectedMeals: checked ? [...f.selectedMeals, id] : f.selectedMeals.filter(x => x !== id),
                }))
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreate} className="flex-1" disabled={creating}>
                  {creating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Kreiranje...</>
                  ) : (
                    <><Plus className="h-4 w-4 mr-2" />Sačuvaj jelovnik</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Otkaži</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv</TableHead>
              <TableHead>Grupa</TableHead>
              <TableHead>Broj obroka</TableHead>
              <TableHead>Smene</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Učitavanje...</TableCell></TableRow>
            ) : pageItems.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nema kreiranih jelovnika</TableCell></TableRow>
            ) : (
              pageItems.map(tpl => {
                const shifts = new Set<string>();
                tpl.meals?.forEach(m => m.meal?.shifts?.forEach(s => shifts.add(s)));
                const shiftLabel = (s: string) => s === "prva" ? "I" : s === "druga" ? "II" : s === "treća" ? "III" : s;
                return (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">
                      {tpl.name}
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{tpl.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {tpl.organization_tag === "Proizvodnja" ? "Proizvodnja" : "Hogo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{tpl.meals?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {[...shifts].sort().map(s => (
                          <Badge key={s} variant="outline" className="text-[10px]">{shiftLabel(s)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {((tpl as any).status === "neaktivan") ? (
                        <Badge variant="outline">Neaktivan</Badge>
                      ) : (
                        <Badge variant="default">Aktivan</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)} title="Izmeni">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Obriši">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Obrisati jelovnik?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Šablon "{tpl.name}" će biti obrisan. Postojeće dodele za datume ostaju netaknute.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Otkaži</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTemplate(tpl.id)}>Obriši</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {filteredTemplates.length > 0 && (
          <div className="p-3 border-t">
            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={filteredTemplates.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Card>

      {/* Edit dialog */}
      <Sheet open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Izmeni jelovnik</SheetTitle>
          </SheetHeader>
          {editing && (
            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="edit-tpl-name">Naziv *</Label>
                <Input
                  id="edit-tpl-name"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  maxLength={100}
                />
              </div>
              <div>
                <Label>Grupa</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  value={editForm.organization_tag}
                  onChange={e => setEditForm({ ...editForm, organization_tag: e.target.value as "Proizvodnja" | "Hogo", selectedMeals: [] })}
                >
                  <option value="Hogo">Hogo</option>
                  <option value="Proizvodnja">Proizvodnja</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-tpl-desc">Opis</Label>
                <Textarea
                  id="edit-tpl-desc"
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              {renderMealPicker(
                editForm.organization_tag,
                editForm.selectedMeals,
                (id, checked) => setEditForm(f => ({
                  ...f,
                  selectedMeals: checked ? [...f.selectedMeals, id] : f.selectedMeals.filter(x => x !== id),
                }))
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleUpdate} className="flex-1" disabled={updating}>
                  {updating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Čuvanje...</>
                  ) : "Sačuvaj izmene"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Otkaži</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
