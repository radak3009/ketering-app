import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Search, SearchX } from 'lucide-react';
import { useFeedback, FeedbackWithProfile } from '@/hooks/useFeedback';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TablePagination } from '@/components/ui/table-pagination';

export function FeedbackManagement() {
  const { feedback, loading, updateFeedback } = useFeedback();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<FeedbackWithProfile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const handleCheckboxChange = async (e: React.MouseEvent, id: string, currentValue: boolean) => {
    e.stopPropagation();
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

  const paginatedFeedback = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFeedback.slice(start, start + pageSize);
  }, [filteredFeedback, currentPage, pageSize]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

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
              onChange={handleSearchChange}
            />
          </div>

          {filteredFeedback.length === 0 ? (
            <EmptyState 
              icon={searchTerm ? SearchX : MessageSquare}
              title={searchTerm ? 'Nema rezultata za pretragu' : 'Nema utisaka'}
              description={searchTerm ? 'Pokušajte sa drugim terminom pretrage' : 'Korisnici još nisu ostavili utiske'}
            />
          ) : (
            <>
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
                    {paginatedFeedback.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedItem(item)}
                      >
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
                            onCheckedChange={() => {}}
                            onClick={(e) => handleCheckboxChange(e, item.id, item.obradeno)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalItems={filteredFeedback.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalji utiska</SheetTitle>
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
                <Label className="text-muted-foreground text-xs">Utisak</Label>
                <p className="mt-1 whitespace-pre-wrap">{selectedItem?.content}</p>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
