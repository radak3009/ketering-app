import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lightbulb, Search, SearchX } from 'lucide-react';
import { useSuggestions, SuggestionWithProfile } from '@/hooks/useSuggestions';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SuggestionsManagement() {
  const { suggestions, loading, updateSuggestion } = useSuggestions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<SuggestionWithProfile | null>(null);

  const handleCheckboxChange = async (e: React.MouseEvent, id: string, currentValue: boolean) => {
    e.stopPropagation();
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
    <>
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
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedItem(item)}
                    >
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
                          onCheckedChange={() => {}}
                          onClick={(e) => handleCheckboxChange(e, item.id, item.obradeno)}
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

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalji predloga</SheetTitle>
            <SheetDescription>
              {selectedItem?.profiles?.full_name || 'N/A'} — {selectedItem ? format(new Date(selectedItem.created_at), 'dd.MM.yyyy HH:mm', { locale: sr }) : ''}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-140px)] mt-4 pr-4">
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Korisnik</Label>
                <p className="font-medium">{selectedItem?.profiles?.full_name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Email</Label>
                <p>{selectedItem?.profiles?.email || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Datum</Label>
                <p>{selectedItem ? format(new Date(selectedItem.created_at), 'dd.MM.yyyy HH:mm', { locale: sr }) : ''}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Obrađeno</Label>
                <div className="mt-1">
                  <Checkbox
                    checked={selectedItem?.obradeno}
                    onCheckedChange={() => {
                      if (selectedItem) {
                        handleCheckboxChange({ stopPropagation: () => {} } as React.MouseEvent, selectedItem.id, selectedItem.obradeno);
                        setSelectedItem({ ...selectedItem, obradeno: !selectedItem.obradeno });
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Naziv jela</Label>
                <p className="mt-1 font-medium">{selectedItem?.meal_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Opis</Label>
                <p className="mt-1 whitespace-pre-wrap">{selectedItem?.description}</p>
              </div>
              {selectedItem?.additional_notes && (
                <div>
                  <Label className="text-muted-foreground text-xs">Napomene</Label>
                  <p className="mt-1 whitespace-pre-wrap">{selectedItem.additional_notes}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
