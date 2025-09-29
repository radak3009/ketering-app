import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChefHat, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import chickenSaladImage from "@/assets/meal-chicken-salad.jpg";
import pastaImage from "@/assets/meal-pasta.jpg";
import salmonImage from "@/assets/meal-salmon.jpg";

interface Meal {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface DaySelection {
  day: string;
  meal?: Meal;
}

const SAMPLE_MEALS: Meal[] = [
  {
    id: "1",
    name: "Piletina sa salatom",
    description: "Sočna piletina sa svežom mešanom salatom i vinaigrette dresingom",
    price: 450,
    image: chickenSaladImage,
    category: "Glavno jelo"
  },
  {
    id: "2", 
    name: "Pasta Primavera",
    description: "Italijanska pasta sa svežim povrćem i parmezan sirom",
    price: 420,
    image: pastaImage,
    category: "Vegetarijanska"
  },
  {
    id: "3",
    name: "Losos sa kinoom",
    description: "Pečeni losos sa kinoom i prženim povrćem",
    price: 520,
    image: salmonImage,
    category: "Morski plodovi"
  }
];

const DAYS = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak"];

export function EmployeeDashboard() {
  const [weekSelections, setWeekSelections] = useState<DaySelection[]>(
    DAYS.map(day => ({ day }))
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { toast } = useToast();

  const handleMealSelect = (meal: Meal) => {
    if (!selectedDay) return;
    
    setWeekSelections(prev => 
      prev.map(selection => 
        selection.day === selectedDay 
          ? { ...selection, meal } 
          : selection
      )
    );
    
    toast({
      title: "Obrok je izabran!",
      description: `${meal.name} za ${selectedDay}`,
    });
    
    setSelectedDay(null);
  };

  const removeMeal = (day: string) => {
    setWeekSelections(prev => 
      prev.map(selection => 
        selection.day === day 
          ? { ...selection, meal: undefined } 
          : selection
      )
    );
    
    toast({
      title: "Obrok je uklonjen",
      description: `Obrok za ${day} je uklonjen`,
      variant: "destructive"
    });
  };

  const totalCost = weekSelections.reduce((sum, selection) => 
    sum + (selection.meal?.price || 0), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent to-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary rounded-lg">
              <ChefHat className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Ketering Portal</h1>
              <p className="text-muted-foreground">Izaberite obroke za narednu sedmicu</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Sedmica: 6-10 Januar 2025</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Rok za izmene: Petak 17:00</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Week Overview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Vaš izbor za sedmicu</CardTitle>
                <CardDescription>
                  Kliknite na dan da izaberete obrok
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {weekSelections.map((selection) => (
                    <div 
                      key={selection.day}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDay(selection.day)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-sm">{selection.day}</div>
                        {selection.meal ? (
                          <div className="flex items-center gap-2">
                            <img 
                              src={selection.meal.image} 
                              alt={selection.meal.name}
                              className="w-8 h-8 rounded object-cover"
                            />
                            <span className="text-sm">{selection.meal.name}</span>
                            <Badge variant="secondary">{selection.meal.price} RSD</Badge>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nije izabrano</span>
                        )}
                      </div>
                      {selection.meal && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMeal(selection.day);
                          }}
                        >
                          Ukloni
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Ukupna cena:</span>
                    <span className="text-lg font-bold text-primary">{totalCost} RSD</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Meal Selection */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDay ? `Izaberite obrok za ${selectedDay}` : "Dostupni obroci"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {SAMPLE_MEALS.map((meal) => (
                    <div 
                      key={meal.id}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <img 
                        src={meal.image} 
                        alt={meal.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-sm">{meal.name}</h3>
                          <Badge variant="outline">{meal.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {meal.description}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-primary">{meal.price} RSD</span>
                          <Button 
                            size="sm" 
                            onClick={() => handleMealSelect(meal)}
                            disabled={!selectedDay}
                            variant={selectedDay ? "default" : "secondary"}
                          >
                            Izaberi
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}