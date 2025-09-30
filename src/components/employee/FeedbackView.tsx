import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Lightbulb, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/hooks/useFeedback';
import { useSuggestions } from '@/hooks/useSuggestions';

export function FeedbackView() {
  const { user } = useAuth();
  const { createFeedback } = useFeedback();
  const { createSuggestion } = useSuggestions();

  const [feedbackContent, setFeedbackContent] = useState('');
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!user?.id || !feedbackContent.trim()) return;

    setSubmittingFeedback(true);
    await createFeedback(feedbackContent, user.id);
    setFeedbackContent('');
    setSubmittingFeedback(false);
  };

  const handleSubmitSuggestion = async () => {
    if (!user?.id || !mealName.trim() || !description.trim()) return;

    setSubmittingSuggestion(true);
    await createSuggestion(
      mealName,
      description,
      additionalNotes.trim() || null,
      user.id
    );
    setMealName('');
    setDescription('');
    setAdditionalNotes('');
    setSubmittingSuggestion(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Utisci i predlozi</h2>
        <p className="text-muted-foreground">
          Podelite vaše mišljenje i predloge za poboljšanje ketering usluge
        </p>
      </div>

      <Tabs defaultValue="feedback" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Knjiga utisaka
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Predlozi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Knjiga utisaka
              </CardTitle>
              <CardDescription>
                Podelite vaše iskustvo sa ketering uslugom, kvalitetom hrane, brzinu usluge, osoblju i svim ostalim
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-content">Vaš utisak</Label>
                <Textarea
                  id="feedback-content"
                  placeholder="Opišite vaše iskustvo sa ketering uslugom, kvalitet hrane, brzinu usluge, osoblje..."
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={handleSubmitFeedback}
                disabled={!feedbackContent.trim() || submittingFeedback}
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                Pošaljite utisak
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Predlog novog obroka
              </CardTitle>
              <CardDescription>
                Predložite novi obrok koji biste voleli da vidite u jelovniku
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meal-name">Naziv obroka</Label>
                  <Input
                    id="meal-name"
                    placeholder="npr. Pileći file sa povrćem"
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Kratak opis</Label>
                  <Input
                    id="description"
                    placeholder="npr. Sočan pileći file sa svežim povrćem"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-notes">Dodatne napomene (opciono)</Label>
                <Textarea
                  id="additional-notes"
                  placeholder="Dodatne informacije o predlogu, zašto mislite da bi ovaj obrok bio dobar izbor..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <Button
                onClick={handleSubmitSuggestion}
                disabled={!mealName.trim() || !description.trim() || submittingSuggestion}
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                Pošaljite predlog
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
