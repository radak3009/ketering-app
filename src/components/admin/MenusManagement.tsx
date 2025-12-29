import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Plus, ChevronDown, ImageIcon, Save, Trash2, Copy, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { useMenus, type MenuWithMeals } from "@/hooks/useMenus";
import { format, startOfWeek, endOfWeek, addWeeks, getWeek, getYear, addDays } from "date-fns";
import { WEEK_DAYS } from "@/constants";

interface MenuFormState {
  description: string;
  menu_date: string;
  selectedMeals: string[];
}

export function MenusManagement() {
  const { toast } = useToast();
  const { meals } = useMeals();
  const { menus, loading, createMenu, updateMenu, deleteMenu, cloneWeekMenus } = useMenus();
  
  const [selectedMenu, setSelectedMenu] = useState<any>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [menuMealSearch, setMenuMealSearch] = useState("");
  
  const [menuForm, setMenuForm] = useState<MenuFormState>({
    description: "",
    menu_date: "",
    selectedMeals: []
  });

  // Clone dialog state
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceMenus, setCloneSourceMenus] = useState<MenuWithMeals[]>([]);
  const [cloneTargetDate, setCloneTargetDate] = useState<Date>();

  const filteredMenuMeals = meals.filter(
    meal => meal.status === "aktivan" && meal.name.toLowerCase().includes(menuMealSearch.toLowerCase())
  );

  const generateMenuName = (date: string) => {
    const menuDate = new Date(date);
    const dayName = WEEK_DAYS[menuDate.getDay()];
    const formattedDate = format(menuDate, 'dd.MM.yyyy');
    return `${dayName} ${formattedDate}`;
  };

  const isDateDisabled = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const hasMenu = menus.some(menu => menu.menu_date === dateStr);
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
    return hasMenu || isPast;
  };

  const handleCreateMenu = async () => {
    if (!menuForm.menu_date || menuForm.selectedMeals.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo odaberite datum i obroke",
        variant: "destructive"
      });
      return;
    }

    const selectedDate = new Date(menuForm.menu_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      toast({
        title: "Greška",
        description: "Ne možete kreirati jelovnik za prošle datume",
        variant: "destructive"
      });
      return;
    }

    const existingMenu = menus.find(menu => menu.menu_date === menuForm.menu_date);
    if (existingMenu) {
      toast({
        title: "Greška",
        description: "Jelovnik za ovaj datum već postoji",
        variant: "destructive"
      });
      return;
    }

    try {
      const menuName = generateMenuName(menuForm.menu_date);
      await createMenu({
        name: menuName,
        description: menuForm.description || undefined,
        menu_date: menuForm.menu_date,
        meal_ids: menuForm.selectedMeals
      });
      
      setMenuForm({ description: "", menu_date: "", selectedMeals: [] });
    } catch (error) {
      console.error('Error creating menu:', error);
    }
  };

  const handleUpdateMenu = async () => {
    if (!selectedMenu) return;
    try {
      const selectedMealIds = selectedMenu.meals?.map((m: any) => m.meal_id) || [];
      await updateMenu(selectedMenu.id, {
        description: selectedMenu.description,
        menu_date: selectedMenu.menu_date,
        meal_ids: selectedMealIds
      });
      setSelectedMenu(null);
    } catch (error) {
      console.error('Error updating menu:', error);
    }
  };

  const handleCloneWeek = (weekMenus: MenuWithMeals[]) => {
    setCloneSourceMenus(weekMenus);
    setCloneTargetDate(undefined);
    setShowCloneDialog(true);
  };

  const handleConfirmClone = async () => {
    if (!cloneTargetDate || cloneSourceMenus.length === 0) return;
    
    try {
      await cloneWeekMenus(cloneSourceMenus, cloneTargetDate);
      setShowCloneDialog(false);
      setCloneSourceMenus([]);
      setCloneTargetDate(undefined);
    } catch (error) {
      console.error('Error cloning week:', error);
    }
  };

  // Group menus by week
  const groupMenusByWeek = (menus: MenuWithMeals[]) => {
    const grouped = new Map<string, { 
      weekNumber: number, 
      year: number, 
      menus: MenuWithMeals[],
      isCurrentWeek: boolean,
      isNextWeek: boolean 
    }>();
    
    const now = new Date();
    const currentWeekNumber = getWeek(now, { weekStartsOn: 1 });
    const currentYear = getYear(now);
    
    const nextWeek = addWeeks(now, 1);
    const nextWeekNumber = getWeek(nextWeek, { weekStartsOn: 1 });
    const nextWeekYear = getYear(nextWeek);
    
    menus.forEach(menu => {
      const date = new Date(menu.menu_date);
      const weekNumber = getWeek(date, { weekStartsOn: 1 });
      const year = getYear(date);
      const key = `${year}-W${weekNumber}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          weekNumber,
          year,
          menus: [],
          isCurrentWeek: weekNumber === currentWeekNumber && year === currentYear,
          isNextWeek: weekNumber === nextWeekNumber && year === nextWeekYear
        });
      }
      
      grouped.get(key)!.menus.push(menu);
    });
    
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
  };

  const groupedMenus = groupMenusByWeek(menus).filter(([key, weekData]) => {
    const firstMenuDate = weekData.menus[0]?.menu_date;
    if (!firstMenuDate) return false;
    
    const weekStart = startOfWeek(new Date(firstMenuDate), { weekStartsOn: 1 });
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    
    return weekStart >= currentWeekStart;
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Calendar className="h-4 w-4 md:h-5 md:w-5" />
                Upravljanje jelovnicima
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Kreiranje i pregled dnevnih jelovnika po nedeljama</CardDescription>
            </div>
            <Sheet open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
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
                    <Label>Datum jelovnika</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {menuForm.menu_date ? format(new Date(menuForm.menu_date), "PPP") : "Izaberite datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={menuForm.menu_date ? new Date(menuForm.menu_date) : undefined}
                          onSelect={(date) => date && setMenuForm({ ...menuForm, menu_date: format(date, 'yyyy-MM-dd') })}
                          disabled={isDateDisabled}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label htmlFor="menu-description">Opis (opciono)</Label>
                    <Textarea 
                      id="menu-description" 
                      value={menuForm.description} 
                      onChange={e => setMenuForm({ ...menuForm, description: e.target.value })} 
                      placeholder="Kratak opis jelovnika..." 
                    />
                  </div>
                  
                  <div>
                    <Label>Pretraži obroke</Label>
                    <Input 
                      placeholder="Pretraži po nazivu..." 
                      value={menuMealSearch} 
                      onChange={e => setMenuMealSearch(e.target.value)} 
                    />
                  </div>
                  
                  <div>
                    <Label>Odaberi obroke</Label>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                      {filteredMenuMeals.map(meal => (
                        <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                          <Checkbox 
                            id={`menu-meal-${meal.id}`} 
                            checked={menuForm.selectedMeals.includes(meal.id)} 
                            onCheckedChange={checked => {
                              if (checked) {
                                setMenuForm({ ...menuForm, selectedMeals: [...menuForm.selectedMeals, meal.id] });
                              } else {
                                setMenuForm({ ...menuForm, selectedMeals: menuForm.selectedMeals.filter(id => id !== meal.id) });
                              }
                            }} 
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
                            <label htmlFor={`menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                              {meal.name}
                            </label>
                            <p className="text-xs text-muted-foreground">{meal.price} RSD</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleCreateMenu} className="flex-1" disabled={loading}>
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj jelovnik
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateMenuOpen(false)}>
                      Završi
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          {groupedMenus.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Nema definisanih jelovnika</p>
          ) : (
            <div className="space-y-2">
              {groupedMenus.map(([key, weekData]) => (
                <Collapsible key={key} defaultOpen={weekData.isCurrentWeek || weekData.isNextWeek}>
                  <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="flex-1 justify-between p-4 h-auto hover:bg-accent/50 group">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base md:text-lg font-medium">
                            {weekData.isCurrentWeek 
                              ? "Tekuća nedelja" 
                              : weekData.isNextWeek 
                                ? "Sledeća nedelja"
                                : `Nedelja ${weekData.weekNumber}`
                            }
                          </h3>
                          <Badge variant="secondary">
                            {weekData.menus.length} {weekData.menus.length === 1 ? 'jelovnik' : 'jelovnika'}
                          </Badge>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneWeek(weekData.menus);
                      }}
                      title="Kloniraj nedelju"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <CollapsibleContent className="px-2 pb-4">
                    <div className="grid gap-2 md:gap-3 mt-2">
                      {weekData.menus.map(menu => (
                        <div 
                          key={menu.id} 
                          className="flex items-center gap-3 md:gap-4 p-3 md:p-4 border rounded-lg hover:bg-muted/50 cursor-pointer" 
                          onClick={() => setSelectedMenu({ ...menu })}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm md:text-base truncate">{menu.name}</p>
                            {menu.description && (
                              <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                                {menu.description}
                              </p>
                            )}
                            <p className="text-xs md:text-sm text-muted-foreground">
                              {menu.meals?.length || 0} obroka
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Menu Sheet */}
      <Sheet open={!!selectedMenu} onOpenChange={() => setSelectedMenu(null)}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalji jelovnika</SheetTitle>
          </SheetHeader>
          {selectedMenu && (
            <div className="space-y-4 mt-6">
              <div>
                <Label>Naziv jelovnika</Label>
                <Input value={selectedMenu.name} disabled />
              </div>
              
              <div>
                <Label>Datum</Label>
                <Input 
                  type="date" 
                  value={selectedMenu.menu_date} 
                  onChange={e => setSelectedMenu({ ...selectedMenu, menu_date: e.target.value })} 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-menu-description">Opis</Label>
                <Textarea 
                  id="edit-menu-description" 
                  value={selectedMenu.description || ''} 
                  onChange={e => setSelectedMenu({ ...selectedMenu, description: e.target.value })} 
                />
              </div>
              
              <div>
                <Label>Pretraži obroke</Label>
                <Input 
                  placeholder="Pretraži po nazivu..." 
                  value={menuMealSearch} 
                  onChange={e => setMenuMealSearch(e.target.value)} 
                />
              </div>
              
              <div>
                <Label>Obroke u jelovniku</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2 mt-2">
                  {filteredMenuMeals.map(meal => (
                    <div key={meal.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                      <Checkbox 
                        id={`edit-menu-meal-${meal.id}`} 
                        checked={selectedMenu.meals?.some((m: any) => m.meal_id === meal.id) || false} 
                        onCheckedChange={checked => {
                          const currentMeals = selectedMenu.meals || [];
                          if (checked) {
                            setSelectedMenu({
                              ...selectedMenu,
                              meals: [...currentMeals, { meal_id: meal.id, meal: meal }]
                            });
                          } else {
                            setSelectedMenu({
                              ...selectedMenu,
                              meals: currentMeals.filter((m: any) => m.meal_id !== meal.id)
                            });
                          }
                        }} 
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
                        <label htmlFor={`edit-menu-meal-${meal.id}`} className="text-sm font-medium cursor-pointer">
                          {meal.name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      Sačuvaj izmene
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da sačuvate izmene za ovaj jelovnik?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUpdateMenu}>Sačuvaj</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši jelovnik
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da obrišete ovaj jelovnik? Ova akcija se ne može poništiti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => {
                        await deleteMenu(selectedMenu.id);
                        setSelectedMenu(null);
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

      {/* Clone Week Dialog */}
      <Sheet open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kloniranje nedelje</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Izvor:</Label>
              <p className="text-sm text-muted-foreground">
                {cloneSourceMenus.length} {cloneSourceMenus.length === 1 ? 'jelovnik' : 'jelovnika'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ciljna nedelja (ponedeljak):</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {cloneTargetDate ? format(cloneTargetDate, "PPP") : "Izaberite datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={cloneTargetDate}
                    onSelect={setCloneTargetDate}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today || date.getDay() !== 1;
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Možete odabrati samo ponedeljak kao početak nedelje</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={!cloneTargetDate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Kloniraj nedelju
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Potvrdi kloniranje</AlertDialogTitle>
                  <AlertDialogDescription>
                    Da li ste sigurni da želite da klonirate {cloneSourceMenus.length} jelovnika u novu nedelju?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Otkaži</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmClone}>Kloniraj</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
