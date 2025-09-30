import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Search, Filter } from 'lucide-react';
import { useFeedback } from '@/hooks/useFeedback';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';

export function FeedbackManagement() {
  const { feedback, loading, updateFeedback } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');

  const handleCheckboxChange = async (id: string, currentValue: boolean) => {
    await updateFeedback(id, !currentValue);
  };

  const filteredFeedback = useMemo(() => {
    if (!searchTerm) return feedback;

    const lowerSearch = searchTerm.toLowerCase();
    return feedback.filter(
      (item) =>
        item.content.toLowerCase().includes(lowerSearch) ||
        item.profiles?.full_name?.toLowerCase().includes(lowerSearch) ||
        item.profiles?.email?.toLowerCase().includes(lowerSearch)
    );
  }, [feedback, searchTerm]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Knjiga utisaka
        </CardTitle>
        <CardDescription>
          Pregled svih utisaka korisnika o ketering usluzi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feedback-search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Pretraži utiske
          </Label>
          <Input
            id="feedback-search"
            placeholder="Pretraži po sadržaju, imenu ili email-u korisnika..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredFeedback.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? 'Nema rezultata za pretragu' : 'Nema utisaka'}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Korisnik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Utisak</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-center">Obrađeno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.profiles?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>{item.profiles?.email || 'N/A'}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="line-clamp-2">{item.content}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: sr })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={item.obradeno}
                        onCheckedChange={() => handleCheckboxChange(item.id, item.obradeno)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
