import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  BarChart3, 
  Users, 
  ChefHat, 
  Calendar, 
  Download, 
  Plus,
  Search,
  Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [newMeal, setNewMeal] = useState({
    name: "",
    description: "",
    price: "",
    category: ""
  });
  const { toast } = useToast();

  const handleAddMeal = () => {
    if (!newMeal.name || !newMeal.price) {
      toast({
        title: "Greška",
        description: "Molimo unesite ime i cenu obroka",
        variant: "destructive"
      });
      return;
    }
    
    toast({
      title: "Obrok je dodat!",
      description: `${newMeal.name} je uspešno dodat u meni`,
    });
    
    setNewMeal({ name: "", description: "", price: "", category: "" });
  };

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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-corporate rounded-lg">
              <BarChart3 className="h-6 w-6 text-corporate-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground">Upravljanje keteringom i izveštajima</p>
            </div>
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

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Porudžbine</TabsTrigger>
            <TabsTrigger value="meals">Upravljanje obrocima</TabsTrigger>
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
                  <CardTitle>Dodaj novi obrok</CardTitle>
                  <CardDescription>Unesite detalje novog obroka</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="meal-name">Naziv obroka</Label>
                    <Input 
                      id="meal-name"
                      value={newMeal.name}
                      onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                      placeholder="npr. Piletina sa rižom"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="meal-description">Opis</Label>
                    <Textarea 
                      id="meal-description"
                      value={newMeal.description}
                      onChange={(e) => setNewMeal({...newMeal, description: e.target.value})}
                      placeholder="Kratak opis obroka..."
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meal-price">Cena (RSD)</Label>
                      <Input 
                        id="meal-price"
                        type="number"
                        value={newMeal.price}
                        onChange={(e) => setNewMeal({...newMeal, price: e.target.value})}
                        placeholder="450"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="meal-category">Kategorija</Label>
                      <Input 
                        id="meal-category"
                        value={newMeal.category}
                        onChange={(e) => setNewMeal({...newMeal, category: e.target.value})}
                        placeholder="Glavno jelo"
                      />
                    </div>
                  </div>
                  
                  <Button onClick={handleAddMeal} className="w-full" variant="gradient">
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj obrok
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Trenutni meni</CardTitle>
                  <CardDescription>Upravljajte postojećim obrocima</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {["Piletina sa salatom", "Pasta Primavera", "Losos sa kinoom"].map((meal) => (
                      <div key={meal} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{meal}</p>
                          <p className="text-sm text-muted-foreground">Aktivno</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Izmeni</Button>
                          <Button variant="destructive" size="sm">Ukloni</Button>
                        </div>
                      </div>
                    ))}
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