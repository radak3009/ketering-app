import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lightbulb, Search, SearchX } from 'lucide-react';
import { useSuggestions } from '@/hooks/useSuggestions';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';

export function SuggestionsManagement() {
  const { suggestions, loading, updateSuggestion } = useSuggestions();
  const [searchTerm, setSearchTerm] = useState('');

  const handleCheckboxChange = async (id: string, currentValue: boolean) => {
    await updateSuggestion(id, !currentValue);
  };

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm) return suggestions;

    const lowerSearch = searchTerm.toLowerCase();
    return suggestions.filter(
      (item) =>
        item.meal_name.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch) ||
        item.profiles?.full_name?.toLowerCase().includes(lowerSearch) ||
        item.profiles?.email?.toLowerCase().includes(lowerSearch)
    );
  }, [suggestions, searchTerm]);

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
          <Lightbulb className="h-5 w-5" />
          Predlozi za nova jela
        </CardTitle>
        <CardDescription>
          Pregled svih predloga korisnika za nova jela i izmene postojećih
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="suggestions-search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Pretraži predloge
          </Label>
          <Input
            id="suggestions-search"
            placeholder="Pretraži po nazivu jela, opisu, imenu ili email-u korisnika..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredSuggestions.length === 0 ? (
          <EmptyState 
            icon={searchTerm ? SearchX : Lightbulb}
            title={searchTerm ? 'Nema rezultata za pretragu' : 'Nema predloga'}
            description={searchTerm ? 'Pokušajte sa drugim terminom pretrage' : 'Korisnici još nisu predložili nova jela'}
          />
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Korisnik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Naziv jela</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Napomene</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-center">Obrađeno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuggestions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.profiles?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell>{item.profiles?.email || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{item.meal_name}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="line-clamp-2">{item.description}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {item.additional_notes ? (
                        <div className="line-clamp-2">{item.additional_notes}</div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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
