import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChefHat, Plus, Edit, Trash2, ImageIcon, Upload, Save, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { TagInput } from "@/components/ui/tag-input";
import { uploadImage } from "@/services/storageService";
import { validateMealCode } from "@/services/validationService";
import { SHIFTS, MEAL_STATUSES, type MealStatus } from "@/constants";
import type { Tables } from "@/integrations/supabase/types";

type Meal = Tables<'meals'>;

interface MealFormState {
  name: string;
  description: string;
  price: string;
  purchase_price: string;
  code: string;
  status: MealStatus;
  shifts: string[];
  allergens: string[];
  image_url: string;
  allowed_tags: string[];
  meal_group: string;
}

interface MealFilters {
  code: string;
  name: string;
  description: string;
  allergens: string;
  shifts: string[];
  status: string;
  allowed_tags: string[];
  meal_group: string;
}

const initialMealForm: MealFormState = {
  name: "",
  description: "",
  price: "400",
  purchase_price: "200",
  code: "",
  status: "aktivan",
  shifts: [],
  allergens: [],
  image_url: "",
  allowed_tags: [],
  meal_group: ""
};

export function MealsManagement() {
  const { toast } = useToast();
  const { meals, loading, createMeal, updateMeal, deleteMeal, refetch } = useMeals();
  
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isAddMealOpen, setIsAddMealOpen] = useState(false);
  const [creatingMeal, setCreatingMeal] = useState(false);
  const [updatingMeal, setUpdatingMeal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mealForm, setMealForm] = useState<MealFormState>(initialMealForm);
  const [mealFilters, setMealFilters] = useState<MealFilters>({
    code: '',
    name: '',
    description: '',
    allergens: '',
    shifts: [],
    status: 'all',
    allowed_tags: [],
    meal_group: 'all'
  });
  const [newGroupInput, setNewGroupInput] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [editNewGroupInput, setEditNewGroupInput] = useState('');
  const [editShowNewGroupInput, setEditShowNewGroupInput] = useState(false);
  const [persistedGroups, setPersistedGroups] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);

  const normalizeGroupName = (value: string | null | undefined) => value?.trim() || '';

  const availableGroups = useMemo(
    () => [...new Set([
      ...persistedGroups,
      ...meals.map(m => normalizeGroupName(m.meal_group)).filter(Boolean),
      ...customGroups
    ])].sort((a, b) => a.localeCompare(b, 'sr', { sensitivity: 'base' })),
    [persistedGroups, meals, customGroups]
  );

  const resetMealForm = () => {
    setMealForm(initialMealForm);
    setImageFile(null);
  };

  const fetchMealGroups = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('meal_groups')
      .select('name')
      .order('name', { ascending: true });

    if (error) throw error;

    const dbGroups = (data || [])
      .map((item: { name: string }) => normalizeGroupName(item.name))
      .filter(Boolean);

    setPersistedGroups(dbGroups);
  }, []);

  const persistMealGroup = useCallback(async (rawGroupName: string) => {
    const groupName = normalizeGroupName(rawGroupName);
    if (!groupName) return '';

    const { error } = await (supabase as any)
      .from('meal_groups')
      .upsert({ name: groupName }, { onConflict: 'name' });

    if (error) throw error;

    setCustomGroups(prev => (prev.includes(groupName) ? prev : [...prev, groupName]));
    return groupName;
  }, []);

  useEffect(() => {
    const fetchTagsAndGroups = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tag')
        .not('tag', 'is', null);

      if (data) {
        const uniqueTags = [...new Set(data.map(p => p.tag).filter(Boolean))] as string[];
        setAvailableTags(uniqueTags.sort());
      }

      try {
        await fetchMealGroups();
      } catch (error) {
        console.error('Error fetching meal groups:', error);
      }
    };

    fetchTagsAndGroups();
  }, [fetchMealGroups]);

  const handleCreateMeal = async () => {
    if (!mealForm.name || !mealForm.price) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv i cenu obroka",
        variant: "destructive"
      });
      return;
    }

    // Validate code uniqueness
    const codeValidation = validateMealCode(mealForm.code, meals);
    if (!codeValidation.isValid) {
      toast({ title: 'Greška', description: codeValidation.error, variant: 'destructive' });
      return;
    }

    setCreatingMeal(true);
    try {
      let imageUrl = mealForm.image_url;
      if (imageFile) {
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) {
          toast({ title: "Greška", description: "Greška pri upload-u slike", variant: "destructive" });
          return;
        }
        imageUrl = uploaded;
      }

      await createMeal({
        name: mealForm.name,
        description: mealForm.description || null,
        price: parseFloat(mealForm.price),
        purchase_price: mealForm.purchase_price ? parseFloat(mealForm.purchase_price) : null,
        category: "Glavno jelo",
        code: mealForm.code || null,
        status: mealForm.status,
        shifts: mealForm.shifts,
        image_url: imageUrl || null,
        is_available: true,
        allergens: mealForm.allergens.length > 0 ? mealForm.allergens : null,
        nutritional_info: null,
        allowed_tags: mealForm.allowed_tags.length > 0 ? mealForm.allowed_tags : null,
        meal_group: mealForm.meal_group || null
      });
      
      resetMealForm();
      setIsAddMealOpen(false);
    } catch (error) {
      console.error('Error creating meal:', error);
    } finally {
      setCreatingMeal(false);
    }
  };

  const handleUpdateMeal = async () => {
    if (!selectedMeal || !selectedMeal.name || !selectedMeal.price) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv i cenu obroka",
        variant: "destructive"
      });
      return;
    }

    // Validate code uniqueness
    const codeValidation = validateMealCode(selectedMeal.code, meals, selectedMeal.id);
    if (!codeValidation.isValid) {
      toast({ title: 'Greška', description: codeValidation.error, variant: 'destructive' });
      return;
    }

    setUpdatingMeal(true);
    try {
      let imageUrl = selectedMeal.image_url;
      if (imageFile) {
        toast({ title: "Upload u toku...", description: "Slika se učitava, molimo sačekajte" });
        const uploaded = await uploadImage(imageFile);
        if (!uploaded) {
          toast({ title: "Greška", description: "Greška pri upload-u slike", variant: "destructive" });
          return;
        }
        imageUrl = uploaded;
      }

      await updateMeal(selectedMeal.id, {
        name: selectedMeal.name,
        description: selectedMeal.description || null,
        price: parseFloat(selectedMeal.price),
        purchase_price: selectedMeal.purchase_price ? parseFloat(selectedMeal.purchase_price) : null,
        code: selectedMeal.code || null,
        status: selectedMeal.status,
        shifts: selectedMeal.shifts,
        allergens: selectedMeal.allergens?.length > 0 ? selectedMeal.allergens : null,
        image_url: imageUrl || null,
        allowed_tags: selectedMeal.allowed_tags?.length > 0 ? selectedMeal.allowed_tags : null,
        meal_group: selectedMeal.meal_group || null
      });

      setSelectedMeal({ ...selectedMeal, image_url: imageUrl });
      setImageFile(null);
    } catch (error) {
      console.error('Error updating meal:', error);
    } finally {
      setUpdatingMeal(false);
    }
  };

  const filteredMeals = meals.filter(meal => {
    const matchesCode = !mealFilters.code || 
      (meal.code && meal.code.toLowerCase().includes(mealFilters.code.toLowerCase()));
    const matchesName = !mealFilters.name || 
      meal.name.toLowerCase().includes(mealFilters.name.toLowerCase());
    const matchesDescription = !mealFilters.description || 
      (meal.description && meal.description.toLowerCase().includes(mealFilters.description.toLowerCase()));
    const matchesAllergens = !mealFilters.allergens || 
      (meal.allergens && meal.allergens.some(a => 
        a.toLowerCase().includes(mealFilters.allergens.toLowerCase())));
    const matchesShifts = mealFilters.shifts.length === 0 || 
      mealFilters.shifts.some(shift => meal.shifts?.includes(shift));
    const matchesStatus = mealFilters.status === 'all' || meal.status === mealFilters.status;
    const matchesTags = mealFilters.allowed_tags.length === 0 ||
      (meal.allowed_tags && mealFilters.allowed_tags.some(tag => meal.allowed_tags?.includes(tag))) ||
      (!meal.allowed_tags && mealFilters.allowed_tags.length === 0);
    const matchesGroup = mealFilters.meal_group === 'all' || 
      (mealFilters.meal_group === '' ? !meal.meal_group : meal.meal_group === mealFilters.meal_group);
    
    return matchesCode && matchesName && matchesDescription && 
           matchesAllergens && matchesShifts && matchesStatus && matchesTags && matchesGroup;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <ChefHat className="h-4 w-4 md:h-5 md:w-5" />
                Upravljanje obrocima
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Pregled i upravljanje ponudom obroka</CardDescription>
            </div>
            <Sheet open={isAddMealOpen} onOpenChange={setIsAddMealOpen}>
              <SheetTrigger asChild>
                <Button onClick={() => { resetMealForm(); setIsAddMealOpen(true); }} className="w-full md:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj obrok
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Dodaj novi obrok</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-6">
                  <div>
                    <Label htmlFor="meal-code">Šifra obroka</Label>
                    <Input 
                      id="meal-code" 
                      value={mealForm.code} 
                      onChange={e => setMealForm({ ...mealForm, code: e.target.value })} 
                      placeholder="001" 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-name">Naziv obroka</Label>
                    <Input 
                      id="meal-name" 
                      value={mealForm.name} 
                      onChange={e => setMealForm({ ...mealForm, name: e.target.value })} 
                      placeholder="Pileći file sa povrćem" 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-purchase-price">Nabavna cena (RSD)</Label>
                    <Input 
                      id="meal-purchase-price" 
                      type="number" 
                      value={mealForm.purchase_price} 
                      onChange={e => setMealForm({ ...mealForm, purchase_price: e.target.value })} 
                      placeholder="200" 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-price">Cena (RSD)</Label>
                    <Input 
                      id="meal-price" 
                      type="number" 
                      value={mealForm.price} 
                      onChange={e => setMealForm({ ...mealForm, price: e.target.value })} 
                      placeholder="450" 
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-description">Opis</Label>
                    <Textarea 
                      id="meal-description" 
                      value={mealForm.description} 
                      onChange={e => setMealForm({ ...mealForm, description: e.target.value })} 
                      placeholder="Kratak opis obroka..." 
                    />
                  </div>
                  
                  <div>
                    <Label>Grupa</Label>
                    {showNewGroupInput ? (
                      <div className="flex gap-2">
                        <Input 
                          value={newGroupInput}
                          onChange={e => setNewGroupInput(e.target.value)}
                          placeholder="Unesite naziv nove grupe..."
                          className="flex-1"
                        />
                        <Button type="button" size="sm" onClick={() => {
                          if (newGroupInput.trim()) {
                            const g = newGroupInput.trim();
                            setMealForm({ ...mealForm, meal_group: g });
                            setCustomGroups(prev => prev.includes(g) ? prev : [...prev, g]);
                            setShowNewGroupInput(false);
                            setNewGroupInput('');
                          }
                        }}>OK</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                          setShowNewGroupInput(false);
                          setNewGroupInput('');
                        }}>Otkaži</Button>
                      </div>
                    ) : (
                      <Select 
                        value={mealForm.meal_group || "__none__"} 
                        onValueChange={(value) => {
                          if (value === '__new__') {
                            setShowNewGroupInput(true);
                          } else if (value === '__none__') {
                            setMealForm({ ...mealForm, meal_group: '' });
                          } else {
                            setMealForm({ ...mealForm, meal_group: value });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite grupu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Bez grupe</SelectItem>
                          {availableGroups.map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                          <SelectItem value="__new__">Nova grupa...</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-allergens">Alergeni</Label>
                    <TagInput
                      value={mealForm.allergens}
                      onChange={(allergens) => setMealForm({ ...mealForm, allergens })}
                      placeholder="Dodajte alergene (gluten, laktoza, jaja...)"
                    />
                  </div>
                  
                  <div>
                    <Label>Status</Label>
                    <Select 
                      value={mealForm.status} 
                      onValueChange={(value: MealStatus) => setMealForm({ ...mealForm, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Odaberite status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aktivan">Aktivan</SelectItem>
                        <SelectItem value="neaktivan">Neaktivan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                   <div>
                    <Label>Dostupnost u smenama</Label>
                    <div className="flex gap-4 mt-2">
                      {SHIFTS.map(shift => (
                        <div key={shift} className="flex items-center space-x-2">
                          <Checkbox 
                            id={shift} 
                            checked={mealForm.shifts.includes(shift)} 
                            onCheckedChange={checked => {
                              if (checked) {
                                setMealForm({ ...mealForm, shifts: [...mealForm.shifts, shift] });
                              } else {
                                setMealForm({ ...mealForm, shifts: mealForm.shifts.filter(s => s !== shift) });
                              }
                            }} 
                          />
                          <label htmlFor={shift} className="text-sm font-medium capitalize">
                            {shift} smena
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {availableTags.length > 0 && (
                    <div>
                      <Label>Dostupnost prema organizaciji</Label>
                      <div className="flex flex-wrap gap-4 mt-2">
                        {availableTags.map(tag => (
                          <div key={tag} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`add-tag-${tag}`} 
                              checked={mealForm.allowed_tags.includes(tag)} 
                              onCheckedChange={checked => {
                                if (checked) {
                                  setMealForm({ ...mealForm, allowed_tags: [...mealForm.allowed_tags, tag] });
                                } else {
                                  setMealForm({ ...mealForm, allowed_tags: mealForm.allowed_tags.filter(t => t !== tag) });
                                }
                              }} 
                            />
                            <label htmlFor={`add-tag-${tag}`} className="text-sm font-medium">
                              {tag}
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        Ako nijedna organizacija nije odabrana, obrok je dostupan svima.
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Slika obroka</Label>
                    <div className="flex gap-2 mt-2">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                        <Upload className="h-4 w-4 mr-2" />
                        {imageFile ? imageFile.name : "Učitaj sliku"}
                      </Button>
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="image/*" 
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setImageFile(file);
                        }} 
                        className="hidden" 
                      />
                    </div>
                    {(imageFile || mealForm.image_url) && (
                      <div className="mt-2">
                        <img 
                          src={imageFile ? URL.createObjectURL(imageFile) : mealForm.image_url} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded-md" 
                        />
                      </div>
                    )}
                  </div>
                  
                  <Button onClick={handleCreateMeal} className="w-full" disabled={loading || creatingMeal}>
                    {creatingMeal ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Kreiranje u toku...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Dodaj obrok
                      </>
                    )}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Učitavanje...</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Šifra</span>
                        <Input
                          placeholder="Pretraži..."
                          value={mealFilters.code}
                          onChange={(e) => setMealFilters(prev => ({...prev, code: e.target.value}))}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Naziv obroka</span>
                        <Input
                          placeholder="Pretraži..."
                          value={mealFilters.name}
                          onChange={(e) => setMealFilters(prev => ({...prev, name: e.target.value}))}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Grupa</span>
                        <Select 
                          value={mealFilters.meal_group} 
                          onValueChange={(value) => setMealFilters(prev => ({...prev, meal_group: value}))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Sve grupe</SelectItem>
                            {availableGroups.map(g => (
                              <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Alergeni</span>
                        <Input
                          placeholder="Pretraži..."
                          value={mealFilters.allergens}
                          onChange={(e) => setMealFilters(prev => ({...prev, allergens: e.target.value}))}
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[180px]">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Organizacija</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-7 text-xs w-full justify-start font-normal">
                              {mealFilters.allowed_tags.length === 0 ? "Sve organizacije" : mealFilters.allowed_tags.join(', ')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2 bg-popover border" align="start">
                            {availableTags.map(tag => (
                              <div key={tag} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                                <Checkbox
                                  id={`filter-tag-${tag}`}
                                  checked={mealFilters.allowed_tags.includes(tag)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setMealFilters(prev => ({ ...prev, allowed_tags: [...prev.allowed_tags, tag] }));
                                    } else {
                                      setMealFilters(prev => ({ ...prev, allowed_tags: prev.allowed_tags.filter(t => t !== tag) }));
                                    }
                                  }}
                                />
                                <Label htmlFor={`filter-tag-${tag}`} className="text-sm cursor-pointer">{tag}</Label>
                              </div>
                            ))}
                            {mealFilters.allowed_tags.length > 0 && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full mt-2 text-xs"
                                onClick={() => setMealFilters(prev => ({...prev, allowed_tags: []}))}
                              >
                                Resetuj filter
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <span className="font-semibold text-xs">Nabavna cena</span>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <span className="font-semibold text-xs">Cena</span>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs">Status</span>
                        <Select 
                          value={mealFilters.status} 
                          onValueChange={(value) => setMealFilters(prev => ({...prev, status: value}))}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Svi</SelectItem>
                            <SelectItem value="aktivan">Aktivan</SelectItem>
                            <SelectItem value="neaktivan">Neaktivan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]">
                      <span className="font-semibold text-xs">Slika</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nema obroka koji odgovaraju filterima
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMeals.map(meal => (
                      <TableRow 
                        key={meal.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedMeal({...meal, shifts: meal.shifts || []})}
                      >
                        <TableCell className="font-mono text-xs font-medium">
                          {meal.code || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="font-medium">{meal.name}</TableCell>
                        <TableCell>
                          {meal.meal_group ? (
                            <Badge variant="outline" className="text-xs">{meal.meal_group}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {meal.allergens && meal.allergens.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {meal.allergens.slice(0, 2).map((a, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                              ))}
                              {meal.allergens.length > 2 && (
                                <Badge variant="outline" className="text-xs">+{meal.allergens.length - 2}</Badge>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {meal.allowed_tags && meal.allowed_tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {meal.allowed_tags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                              {meal.allowed_tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">+{meal.allowed_tags.length - 2}</Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sve</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {meal.purchase_price ? `${meal.purchase_price} RSD` : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{meal.price} RSD</TableCell>
                        <TableCell>
                          <Badge variant={meal.status === 'aktivan' ? 'default' : 'secondary'}>
                            {meal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {meal.image_url ? (
                            <img src={meal.image_url} alt={meal.name} className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Meal Sheet */}
      <Sheet open={!!selectedMeal} onOpenChange={() => { setSelectedMeal(null); setImageFile(null); }}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Izmeni obrok</SheetTitle>
          </SheetHeader>
          {selectedMeal && (
            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="edit-meal-code">Šifra obroka</Label>
                <Input 
                  id="edit-meal-code" 
                  value={selectedMeal.code || ''} 
                  onChange={e => setSelectedMeal({ ...selectedMeal, code: e.target.value })} 
                  placeholder="001" 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-meal-name">Naziv obroka</Label>
                <Input 
                  id="edit-meal-name" 
                  value={selectedMeal.name} 
                  onChange={e => setSelectedMeal({ ...selectedMeal, name: e.target.value })} 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-meal-purchase-price">Nabavna cena (RSD)</Label>
                <Input 
                  id="edit-meal-purchase-price" 
                  type="number" 
                  value={selectedMeal.purchase_price || ''} 
                  onChange={e => setSelectedMeal({ ...selectedMeal, purchase_price: e.target.value })} 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-meal-price">Cena (RSD)</Label>
                <Input 
                  id="edit-meal-price" 
                  type="number" 
                  value={selectedMeal.price} 
                  onChange={e => setSelectedMeal({ ...selectedMeal, price: e.target.value })} 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-meal-description">Opis</Label>
                <Textarea 
                  id="edit-meal-description" 
                  value={selectedMeal.description || ''} 
                  onChange={e => setSelectedMeal({ ...selectedMeal, description: e.target.value })} 
                />
              </div>
              
              <div>
                <Label>Grupa</Label>
                {editShowNewGroupInput ? (
                  <div className="flex gap-2">
                    <Input 
                      value={editNewGroupInput}
                      onChange={e => setEditNewGroupInput(e.target.value)}
                      placeholder="Unesite naziv nove grupe..."
                      className="flex-1"
                    />
                    <Button type="button" size="sm" onClick={() => {
                      if (editNewGroupInput.trim()) {
                        const g = editNewGroupInput.trim();
                        setSelectedMeal({ ...selectedMeal, meal_group: g });
                        setCustomGroups(prev => prev.includes(g) ? prev : [...prev, g]);
                        setEditShowNewGroupInput(false);
                        setEditNewGroupInput('');
                      }
                    }}>OK</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => {
                      setEditShowNewGroupInput(false);
                      setEditNewGroupInput('');
                    }}>Otkaži</Button>
                  </div>
                ) : (
                  <Select 
                    value={selectedMeal.meal_group || "__none__"} 
                    onValueChange={(value) => {
                      if (value === '__new__') {
                        setEditShowNewGroupInput(true);
                      } else if (value === '__none__') {
                        setSelectedMeal({ ...selectedMeal, meal_group: '' });
                      } else {
                        setSelectedMeal({ ...selectedMeal, meal_group: value });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Odaberite grupu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Bez grupe</SelectItem>
                      {availableGroups.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                      <SelectItem value="__new__">Nova grupa...</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Alergeni</Label>
                <TagInput
                  value={selectedMeal.allergens || []}
                  onChange={(allergens) => setSelectedMeal({ ...selectedMeal, allergens })}
                  placeholder="Dodajte alergene..."
                />
              </div>
              
              <div>
                <Label>Status</Label>
                <Select 
                  value={selectedMeal.status} 
                  onValueChange={(value: MealStatus) => setSelectedMeal({ ...selectedMeal, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktivan">Aktivan</SelectItem>
                    <SelectItem value="neaktivan">Neaktivan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Dostupnost u smenama</Label>
                <div className="flex gap-4 mt-2">
                  {SHIFTS.map(shift => (
                    <div key={shift} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-${shift}`} 
                        checked={selectedMeal.shifts?.includes(shift)} 
                        onCheckedChange={checked => {
                          const shifts = selectedMeal.shifts || [];
                          if (checked) {
                            setSelectedMeal({ ...selectedMeal, shifts: [...shifts, shift] });
                          } else {
                            setSelectedMeal({ ...selectedMeal, shifts: shifts.filter((s: string) => s !== shift) });
                          }
                        }} 
                      />
                      <label htmlFor={`edit-${shift}`} className="text-sm font-medium capitalize">
                        {shift} smena
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {availableTags.length > 0 && (
                <div>
                  <Label>Dostupnost prema organizaciji</Label>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {availableTags.map(tag => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-tag-${tag}`} 
                          checked={selectedMeal.allowed_tags?.includes(tag) || false} 
                          onCheckedChange={checked => {
                            const tags = selectedMeal.allowed_tags || [];
                            if (checked) {
                              setSelectedMeal({ ...selectedMeal, allowed_tags: [...tags, tag] });
                            } else {
                              setSelectedMeal({ ...selectedMeal, allowed_tags: tags.filter((t: string) => t !== tag) });
                            }
                          }} 
                        />
                        <label htmlFor={`edit-tag-${tag}`} className="text-sm font-medium">
                          {tag}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Ako nijedna organizacija nije odabrana, obrok je dostupan svima.
                  </p>
                </div>
              )}

              <div>
                <Label>Slika obroka</Label>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    {imageFile ? imageFile.name : "Promeni sliku"}
                  </Button>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setImageFile(file);
                    }} 
                    className="hidden" 
                  />
                </div>
                {(imageFile || selectedMeal.image_url) && (
                  <div className="mt-2">
                    <img 
                      src={imageFile ? URL.createObjectURL(imageFile) : selectedMeal.image_url} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-md" 
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={updatingMeal}>
                      {updatingMeal ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Čuvanje u toku...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Sačuvaj izmene
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da sačuvate izmene za ovaj obrok?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={updatingMeal}>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUpdateMeal} disabled={updatingMeal}>
                        {updatingMeal ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Čuvanje...
                          </>
                        ) : (
                          'Sačuvaj'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši obrok
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da obrišete ovaj obrok? Ova akcija se ne može poništiti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => {
                        await deleteMeal(selectedMeal.id);
                        setSelectedMeal(null);
                      }}>
                        Obriši
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
