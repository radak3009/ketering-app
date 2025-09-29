import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChefHat, 
  Users, 
  Calendar, 
  BarChart3, 
  Clock, 
  Shield,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import heroImage from "@/assets/hero-catering.jpg";

interface LandingPageProps {
  onRoleSelect: (role: 'employee' | 'admin') => void;
}

export function LandingPage({ onRoleSelect }: LandingPageProps) {
  const [selectedRole, setSelectedRole] = useState<'employee' | 'admin' | null>(null);

  const features = [
    {
      icon: Calendar,
      title: "Nedeljno planiranje",
      description: "Zaposleni biraju obroke za celu sedmicu unapred"
    },
    {
      icon: Clock,
      title: "Fleksibilni rokovi",
      description: "Mogućnost izmene izbora do određenog roka"
    },
    {
      icon: BarChart3,
      title: "Detaljni izveštaji",
      description: "Kompletni uvid u porudžbine i troškove"
    },
    {
      icon: Shield,
      title: "Sigurno upravljanje",
      description: "Kontrola pristupa i sigurnost podataka"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-accent via-background to-accent/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="container mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="secondary" className="text-sm">
                  Korporativno ketering rešenje
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
                  Upravljanje
                  <span className="text-primary"> keteringom </span>
                  za moderne kompanije
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Jednostavno rešenje za organizaciju obroka u kompanijama sa 300+ zaposlenih. 
                  Efikasno planiranje, lako naručivanje, detaljni izveštaji.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  variant="gradient"
                  onClick={() => setSelectedRole('employee')}
                  className="text-lg px-8 py-6"
                >
                  <Users className="h-5 w-5 mr-2" />
                  Uloguj se kao zaposleni
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button 
                  size="lg" 
                  variant="corporate"
                  onClick={() => setSelectedRole('admin')}
                  className="text-lg px-8 py-6"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  Admin pristup
                </Button>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl"></div>
              <img 
                src={heroImage} 
                alt="Corporate catering"
                className="w-full h-[500px] object-cover rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-background/80">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Zašto izabrati naše rešenje?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Napredne funkcionalnosti koje čine upravljanje keteringom jednostavnim i efikasnim
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="pt-8">
                  <div className="mb-4">
                    <div className="inline-flex p-4 bg-primary rounded-full">
                      <feature.icon className="h-8 w-8 text-primary-foreground" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Role Selection Modal */}
      {selectedRole && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedRole === 'employee' ? (
                  <>
                    <Users className="h-5 w-5" />
                    Zaposleni pristup
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    Administrator pristup
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {selectedRole === 'employee' 
                  ? "Pristup funkcionalnostima za izbor i upravljanje obrocima"
                  : "Pristup admin panelu za upravljanje menijem i izveštajima"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Dostupne funkcionalnosti:</h4>
                <div className="space-y-1">
                  {selectedRole === 'employee' ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Izbor obroka za sedmicu</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Izmena porudžbina do roka</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Pregled istorije</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Upravljanje menijem</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Pregled svih porudžbina</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span>Generisanje izveštaja</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedRole(null)}
                  className="flex-1"
                >
                  Otkaži
                </Button>
                <Button 
                  onClick={() => onRoleSelect(selectedRole)}
                  className="flex-1"
                  variant={selectedRole === 'employee' ? 'default' : 'corporate'}
                >
                  Nastavi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}