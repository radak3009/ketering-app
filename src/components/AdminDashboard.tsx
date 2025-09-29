import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BarChart3, 
  Users, 
  ChefHat, 
  Calendar, 
  Download, 
  Plus,
  Search,
  Filter,
  LogOut,
  Edit,
  Trash2,
  Mail,
  ImageIcon,
  Clock
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMeals } from "@/hooks/useMeals";
import { useMenus } from "@/hooks/useMenus";
import { useUsers } from "@/hooks/useUsers";

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  employeesOrdered: number;
  avgOrderValue: number;
}

interface DailyOrders {
  day: string;
  orders: number;
  revenue: number;
}

const SAMPLE_STATS: OrderStats = {
  totalOrders: 847,
  totalRevenue: 382150,
  employeesOrdered: 245,
  avgOrderValue: 451
};

const SAMPLE_DAILY_ORDERS: DailyOrders[] = [
  { day: "Ponedeljak", orders: 180, revenue: 81000 },
  { day: "Utorak", orders: 165, revenue: 74250 },
  { day: "Sreda", orders: 172, revenue: 77400 },
  { day: "Četvrtak", orders: 158, revenue: 71100 },
  { day: "Petak", orders: 172, revenue: 78400 }
];

export function AdminDashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { meals, loading: mealsLoading, createMeal, updateMeal, deleteMeal } = useMeals();
  const { menus, loading: menusLoading, createMenu, deleteMenu } = useMenus();
  const { users, loading: usersLoading, updateUser, deleteUser, sendMagicLink } = useUsers();

  // Meal form state
  const [mealForm, setMealForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    status: "aktivan" as "aktivan" | "neaktivan",
    shifts: [] as string[],
    image_url: ""
  });

  // Menu form state
  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    menu_date: "",
    selectedMeals: [] as string[]
  });

  // User form state
  const [editingUser, setEditingUser] = useState<any>(null);

  // Search states
  const [mealSearch, setMealSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const handleCreateMeal = async () => {
    if (!mealForm.name || !mealForm.price || !mealForm.category) {
      toast({
        title: "Greška",
        description: "Molimo unesite sve obavezne podatke",
        variant: "destructive"
      });
      return;
    }

    try {
      await createMeal({
        name: mealForm.name,
        description: mealForm.description || null,
        price: parseFloat(mealForm.price),
        category: mealForm.category,
        status: mealForm.status,
        shifts: mealForm.shifts,
        image_url: mealForm.image_url || null,
        is_available: true,
        allergens: null,
        nutritional_info: null
      });
      
      setMealForm({
        name: "",
        description: "",
        price: "",
        category: "",
        status: "aktivan",
        shifts: [],
        image_url: ""
      });
    } catch (error) {
      console.error('Error creating meal:', error);
    }
  };

  const handleCreateMenu = async () => {
    if (!menuForm.name || !menuForm.menu_date || menuForm.selectedMeals.length === 0) {
      toast({
        title: "Greška",
        description: "Molimo unesite naziv, datum i odaberite obroke",
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

    try {
      await createMenu({
        name: menuForm.name,
        description: menuForm.description || undefined,
        menu_date: menuForm.menu_date,
        meal_ids: menuForm.selectedMeals
      });
      
      setMenuForm({
        name: "",
        description: "",
        menu_date: "",
        selectedMeals: []
      });
    } catch (error) {
      console.error('Error creating menu:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      await updateUser(editingUser.id, {
        full_name: editingUser.full_name,
        email: editingUser.email,
        phone: editingUser.phone,
        role: editingUser.role
      });
      
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const filteredMeals = meals.filter(meal => 
    meal.status === "aktivan" && 
    meal.name.toLowerCase().includes(mealSearch.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleExportReport = () => {
    toast({
      title: "Izveštaj se generiše",
      description: "CSV fajl će biti preuzet za nekoliko sekundi",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-corporate/5 to-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-corporate rounded-lg">
                <BarChart3 className="h-6 w-6 text-corporate-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
                <p className="text-muted-foreground">Upravljanje keteringom i izveštajima</p>
              </div>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Odjavi se
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-corporate" />
                <div>
                  <p className="text-sm text-muted-foreground">Ukupno porudžbina</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.totalOrders}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm text-muted-foreground">Ukupan prihod</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.totalRevenue.toLocaleString()} RSD</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Zaposleni poručili</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.employeesOrdered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm text-muted-foreground">Prosečna porudžbina</p>
                  <p className="text-2xl font-bold">{SAMPLE_STATS.avgOrderValue} RSD</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="meals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="orders">Porudžbine</TabsTrigger>
            <TabsTrigger value="meals">Obroci</TabsTrigger>
            <TabsTrigger value="menus">Jelovnici</TabsTrigger>
            <TabsTrigger value="users">Korisnici</TabsTrigger>
            <TabsTrigger value="reports">Izveštaji</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Pregled porudžbina</CardTitle>
                    <CardDescription>Sedmica: 6-10 Januar 2025</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-1" />
                      Pretraži
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-1" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {SAMPLE_DAILY_ORDERS.map((day) => (
                    <div key={day.day} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-medium">{day.day}</h3>
                        <p className="text-sm text-muted-foreground">{day.orders} porudžbina</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{day.revenue.toLocaleString()} RSD</p>
                        <Badge variant="secondary">{day.orders} kom</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meals">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5" />
                    Dodaj novi obrok
                  </CardTitle>
                  <CardDescription>Unesite detalje novog obroka</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meal-name">Naziv obroka *</Label>
                      <Input 
                        id="meal-name"
                        value={mealForm.name}
                        onChange={(e) => setMealForm({...mealForm, name: e.target.value})}
                        placeholder="npr. Piletina sa rižom"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="meal-price">Cena (RSD) *</Label>
                      <Input 
                        id="meal-price"
                        type="number"
                        value={mealForm.price}
                        onChange={(e) => setMealForm({...mealForm, price: e.target.value})}
                        placeholder="450"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-description">Opis</Label>
                    <Textarea 
                      id="meal-description"
                      value={mealForm.description}
                      onChange={(e) => setMealForm({...mealForm, description: e.target.value})}
                      placeholder="Kratak opis obroka..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meal-category">Kategorija *</Label>
                      <Input 
                        id="meal-category"
                        value={mealForm.category}
                        onChange={(e) => setMealForm({...mealForm, category: e.target.value})}
                        placeholder="Glavno jelo"
                      />
                    </div>
                    
                    <div>
                      <Label>Status</Label>
                      <Select 
                        value={mealForm.status} 
                        onValueChange={(value: "aktivan" | "neaktivan") => setMealForm({...mealForm, status: value})}
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
                  </div>

                  <div>
                    <Label>Dostupnost u smenama</Label>
                    <div className="flex gap-4 mt-2">
                      {["prva", "druga", "treća"].map((shift) => (
                        <div key={shift} className="flex items-center space-x-2">
                          <Checkbox
                            id={shift}
                            checked={mealForm.shifts.includes(shift)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMealForm({...mealForm, shifts: [...mealForm.shifts, shift]});
                              } else {
                                setMealForm({...mealForm, shifts: mealForm.shifts.filter(s => s !== shift)});
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

                  <div>
                    <Label htmlFor="meal-image">URL slike</Label>
                    <Input 
                      id="meal-image"
                      value={mealForm.image_url}
                      onChange={(e) => setMealForm({...mealForm, image_url: e.target.value})}
                      placeholder="https://example.com/slika.jpg"
                    />
                  </div>
                  
                  <Button onClick={handleCreateMeal} className="w-full" variant="gradient" disabled={mealsLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj obrok
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5" />
                    Upravljanje obrocima
                  </CardTitle>
                  <CardDescription>Svi obroci u sistemu</CardDescription>
                </CardHeader>
                <CardContent>
                  {mealsLoading ? (
                    <div className="text-center py-8">Učitavanje...</div>
                  ) : (
                    <div className="space-y-3">
                      {meals.map((meal) => (
                        <div key={meal.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{meal.name}</p>
                              <Badge variant={meal.status === "aktivan" ? "default" : "secondary"}>
                                {meal.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{meal.price} RSD - {meal.category}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {meal.shifts?.join(', ')} smena
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => updateMeal(meal.id, { 
                                status: meal.status === "aktivan" ? "neaktivan" : "aktivan" 
                              })}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteMeal(meal.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="menus">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Kreiraj jelovnik
                  </CardTitle>
                  <CardDescription>Dodajte novi jelovnik za određeni datum</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="menu-name">Naziv jelovnika *</Label>
                    <Input 
                      id="menu-name"
                      value={menuForm.name}
                      onChange={(e) => setMenuForm({...menuForm, name: e.target.value})}
                      placeholder="npr. Jelovnik za ponedeljak"
                    />
                  </div>

                  <div>
                    <Label htmlFor="menu-date">Datum *</Label>
                    <Input 
                      id="menu-date"
                      type="date"
                      value={menuForm.menu_date}
                      onChange={(e) => setMenuForm({...menuForm, menu_date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <Label htmlFor="menu-description">Opis</Label>
                    <Textarea 
                      id="menu-description"
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({...menuForm, description: e.target.value})}
                      placeholder="Kratak opis jelovnika..."
                    />
                  </div>

                  <div>
                    <Label>Pretraži obroke</Label>
                    <div className="flex gap-2">
                      <Search className="h-4 w-4 mt-3 text-muted-foreground" />
                      <Input 
                        value={mealSearch}
                        onChange={(e) => setMealSearch(e.target.value)}
                        placeholder="Pretraži po nazivu..."
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Odaberite obroke</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                      {filteredMeals.map((meal) => (
                        <div key={meal.id} className="flex items-center space-x-2 py-2">
                          <Checkbox
                            id={meal.id}
                            checked={menuForm.selectedMeals.includes(meal.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setMenuForm({...menuForm, selectedMeals: [...menuForm.selectedMeals, meal.id]});
                              } else {
                                setMenuForm({...menuForm, selectedMeals: menuForm.selectedMeals.filter(id => id !== meal.id)});
                              }
                            }}
                          />
                          <label htmlFor={meal.id} className="text-sm">
                            {meal.name} - {meal.price} RSD
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button onClick={handleCreateMenu} className="w-full" variant="gradient" disabled={menusLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Kreiraj jelovnik
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Postojeći jelovnici
                  </CardTitle>
                  <CardDescription>Upravljanje jelovnicima</CardDescription>
                </CardHeader>
                <CardContent>
                  {menusLoading ? (
                    <div className="text-center py-8">Učitavanje...</div>
                  ) : (
                    <div className="space-y-3">
                      {menus.map((menu) => (
                        <div key={menu.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium">{menu.name}</h3>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteMenu(menu.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Datum: {new Date(menu.menu_date).toLocaleDateString('sr-RS')}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Obroci: {menu.meals?.length || 0}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pretraga korisnika
                  </CardTitle>
                  <CardDescription>Pronađi i upravljaj korisnicima</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <Search className="h-4 w-4 mt-3 text-muted-foreground" />
                      <Input 
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Pretraži po imenu ili email-u..."
                      />
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="text-center py-8">Učitavanje...</div>
                  ) : (
                    <div className="space-y-3">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{user.full_name || 'Bez imena'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="mt-1">
                              {user.role}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingUser({...user})}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Izmeni korisnika</DialogTitle>
                                </DialogHeader>
                                {editingUser && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Ime i prezime</Label>
                                      <Input 
                                        value={editingUser.full_name || ""}
                                        onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Email</Label>
                                      <Input 
                                        value={editingUser.email || ""}
                                        onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Telefon</Label>
                                      <Input 
                                        value={editingUser.phone || ""}
                                        onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label>Uloga</Label>
                                      <Select 
                                        value={editingUser.role} 
                                        onValueChange={(value) => setEditingUser({...editingUser, role: value})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="employee">Zaposleni</SelectItem>
                                          <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button onClick={handleUpdateUser} className="w-full">
                                      Sačuvaj promene
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => sendMagicLink(user.email!)}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => deleteUser(user.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Pozivnice
                  </CardTitle>
                  <CardDescription>Pošaljite pozivnice novim korisnicima</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-accent rounded-lg">
                    <h3 className="font-medium mb-2">Magic Link pozivnice</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Kliknite na dugme Mail kod korisnika da pošaljete magic link za prijavu
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>Automatska registracija kroz email link</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Generiši izveštaje</CardTitle>
                <CardDescription>Preuzmite detaljne izveštaje o porudžbinama</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <Button onClick={handleExportReport} variant="corporate" className="h-20">
                    <div className="text-center">
                      <Download className="h-6 w-6 mx-auto mb-2" />
                      <span>Nedeljni izveštaj</span>
                    </div>
                  </Button>
                  
                  <Button onClick={handleExportReport} variant="success" className="h-20">
                    <div className="text-center">
                      <BarChart3 className="h-6 w-6 mx-auto mb-2" />
                      <span>Mesečni izveštaj</span>
                    </div>
                  </Button>
                </div>
                
                <div className="p-4 bg-accent rounded-lg">
                  <h3 className="font-medium mb-2">Automatski izveštaji</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Podesiti automatsko slanje izveštaja na email svakog ponedeljka
                  </p>
                  <Button variant="outline" size="sm">
                    Podesi automatiku
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}