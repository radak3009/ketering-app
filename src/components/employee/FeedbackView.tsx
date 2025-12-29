import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

export function FeedbackView() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { createFeedback } = useFeedback();
  const { createSuggestion } = useSuggestions();
  const { toast } = useToast();

  const feedbackSchema = z.object({
    content: z.string()
      .trim()
      .min(10, t('feedback.validationError'))
      .max(2000, t('feedback.validationError')),
  });

  const suggestionSchema = z.object({
    mealName: z.string()
      .trim()
      .min(2, t('feedback.validationError'))
      .max(100, t('feedback.validationError')),
    description: z.string()
      .trim()
      .min(10, t('feedback.validationError'))
      .max(500, t('feedback.validationError')),
    additionalNotes: z.string()
      .trim()
      .max(1000, t('feedback.validationError'))
      .optional(),
  });

  const [feedbackContent, setFeedbackContent] = useState('');
  const [mealName, setMealName] = useState('');
  const [description, setDescription] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!user?.id) return;

    try {
      const validatedData = feedbackSchema.parse({ content: feedbackContent });
      
      setSubmittingFeedback(true);
      await createFeedback(validatedData.content, user.id);
      setFeedbackContent('');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('feedback.validationError'),
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!user?.id) return;

    try {
      const validatedData = suggestionSchema.parse({
        mealName,
        description,
        additionalNotes: additionalNotes || undefined,
      });

      setSubmittingSuggestion(true);
      await createSuggestion(
        validatedData.mealName,
        validatedData.description,
        validatedData.additionalNotes || null,
        user.id
      );
      setMealName('');
      setDescription('');
      setAdditionalNotes('');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t('feedback.validationError'),
          description: error.errors[0].message,
          variant: 'destructive',
        });
      }
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('feedback.title')}</h2>
        <p className="text-muted-foreground">
          {t('feedback.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="feedback" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('feedback.feedbackTab')}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            {t('feedback.suggestionsTab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t('feedback.feedbackTitle')}
              </CardTitle>
              <CardDescription>
                {t('feedback.feedbackDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feedback-content">{t('feedback.yourFeedback')}</Label>
                <Textarea
                  id="feedback-content"
                  placeholder={t('feedback.feedbackPlaceholder')}
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
                {t('feedback.sendFeedback')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                {t('feedback.suggestionTitle')}
              </CardTitle>
              <CardDescription>
                {t('feedback.suggestionDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="meal-name">{t('feedback.mealName')}</Label>
                  <Input
                    id="meal-name"
                    placeholder={t('feedback.mealNamePlaceholder')}
                    value={mealName}
                    onChange={(e) => setMealName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('feedback.mealDescription')}</Label>
                  <Input
                    id="description"
                    placeholder={t('feedback.mealDescriptionPlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-notes">{t('feedback.additionalNotes')}</Label>
                <Textarea
                  id="additional-notes"
                  placeholder={t('feedback.additionalNotesPlaceholder')}
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
                {t('feedback.sendSuggestion')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
