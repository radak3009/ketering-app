import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EnhancedDatePicker } from "@/components/ui/enhanced-date-picker";
import { Users, Plus, FileText, Upload, Mail, Trash2, Save, Key, X, Download, Tag, CheckSquare, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SendInvitationDialog } from './SendInvitationDialog';
import { TablePagination } from "@/components/ui/table-pagination";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/useUsers";
import { validateCompanyCardId, validatePassword } from "@/services/validationService";
import { format } from "date-fns";
import type { Role } from "@/constants";

interface UserFormState {
  full_name: string;
  email: string;
  phone: string;
  company_card_id: string;
  company_card_serial: string;
  tag: string;
  date_of_birth: Date | undefined;
  role: Role;
  password: string;
  usePassword: boolean;
}

interface UserFilters {
  id: string;
  fullName: string;
  email: string;
  tag: string;
  phone: string;
  dateOfBirth: string;
  role: string;
}

// Funkcija za generisanje privremene lozinke
const generateTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const initialUserForm: UserFormState = {
  full_name: "",
  email: "",
  phone: "",
  company_card_id: "",
  tag: "",
  date_of_birth: undefined,
  role: "employee",
  password: generateTemporaryPassword(),
  usePassword: true
};

export function UsersManagement() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { users, loading, createUser, updateUser, deleteUser, changeUserRole, sendMagicLink, sendInvitationWithCredentials, resetUserPassword } = useUsers();
  const [changingRole, setChangingRole] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  
  const [userForm, setUserForm] = useState<UserFormState>(initialUserForm);
  const [userFilters, setUserFilters] = useState<UserFilters>({
    id: '',
    fullName: '',
    email: '',
    tag: '',
    phone: '',
    dateOfBirth: '',
    role: 'all'
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
    isOpen: false
  });

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Pagination state
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(20);

  // State for custom tag input
  const [showCustomTagInput, setShowCustomTagInput] = useState(false);
  const [showBulkCustomTagInput, setShowBulkCustomTagInput] = useState(false);
  const [showEditCustomTagInput, setShowEditCustomTagInput] = useState(false);

  // Invitation dialog state
  const [inviteDialogUser, setInviteDialogUser] = useState<any>(null);
  const resetUserForm = () => {
    setUserForm({
      ...initialUserForm,
      password: generateTemporaryPassword()
    });
  };

  const handleClearFile = () => {
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ['Ime i prezime', 'Email', 'ID', 'Tag', 'Telefon', 'Datum rodjenja', 'Uloga', 'Privremena lozinka'];
    const exampleRow = ['Marko Marković', 'marko@firma.rs', '1234567890', 'VIP', '0641234567', '15.03.1985', 'employee', 'TempPass123'];
    
    const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_korisnici.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper za parsiranje datuma iz različitih formata
  const parseImportDate = (dateStr: string): string | undefined => {
    if (!dateStr || dateStr.trim() === '') return undefined;
    const trimmed = dateStr.trim();
    
    // Format: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Format: DD.MM.YYYY ili DD/MM/YYYY
    const match = trimmed.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    return undefined;
  };

  const handleCreateUser = async () => {
    if (!userForm.full_name || !userForm.email) {
      toast({ title: "Greška", description: "Molimo unesite ime i email", variant: "destructive" });
      return;
    }

    if (!userForm.company_card_id || userForm.company_card_id.trim() === '') {
      toast({ title: "Greška", description: "ID zaposlenog je obavezan", variant: "destructive" });
      return;
    }

    const cardValidation = validateCompanyCardId(userForm.company_card_id, users);
    if (!cardValidation.isValid) {
      toast({ title: 'Greška', description: cardValidation.error, variant: 'destructive' });
      return;
    }

    if (userForm.usePassword) {
      const passwordValidation = validatePassword(userForm.password, true);
      if (!passwordValidation.isValid) {
        toast({ title: 'Greška', description: passwordValidation.error, variant: 'destructive' });
        return;
      }
    }

    try {
      await createUser({
        ...userForm,
        password: userForm.usePassword ? userForm.password : undefined
      });
      resetUserForm();
      setIsAddUserOpen(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    const cardValidation = validateCompanyCardId(selectedUser.company_card_id, users, selectedUser.id);
    if (!cardValidation.isValid) {
      toast({ title: 'Greška', description: cardValidation.error, variant: 'destructive' });
      return;
    }

    setUpdatingUser(true);
    // Capture values before any async operation to prevent stale closures
    const userToSave = { ...selectedUser };
    try {
      await updateUser(userToSave.id, {
        full_name: userToSave.full_name,
        email: userToSave.email,
        phone: userToSave.phone,
        company_card_id: userToSave.company_card_id,
        tag: userToSave.tag && userToSave.tag.trim() !== '' ? userToSave.tag.trim() : null,
        date_of_birth: userToSave.date_of_birth || null
      });
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleBulkUserImport = async () => {
    if (!csvFile) {
      toast({ title: "Greška", description: "Molimo odaberite fajl", variant: "destructive" });
      return;
    }
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const requiredFields = ['ime', 'email'];
      const hasRequiredFields = requiredFields.every(field => 
        headers.some(h => h.includes(field) || h.includes(field.replace('ime', 'name')))
      );
      
      if (!hasRequiredFields) {
        toast({ title: "Greška", description: "CSV mora sadržavati kolone: Ime, Email", variant: "destructive" });
        return;
      }

      const usersToImport = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const userData: any = { role: 'employee' };
        
        headers.forEach((header, index) => {
          const value = values[index];
          if (!value || value.trim() === '') return;
          
          // Ime i prezime
          if (header.includes('ime') || header.includes('name') || header.includes('full_name')) {
            userData.full_name = value;
          }
          // Email
          if (header.includes('email') || header.includes('e-mail')) {
            userData.email = value;
          }
          // Telefon
          if (header.includes('phone') || header.includes('telefon')) {
            userData.phone = value;
          }
          // ID (company_card_id) - samo cifre, max 10, bez @
          if (header.includes('company_card_id') || header === 'id' || header.includes('kartica')) {
            if (!value.includes('@')) {
              userData.company_card_id = value.replace(/\D/g, '').slice(0, 10);
            }
          }
          // Datum rođenja
          if (header.includes('datum') || header.includes('date') || header.includes('dob') || header.includes('rodjenja') || header.includes('rođenja')) {
            const parsedDate = parseImportDate(value);
            if (parsedDate) userData.date_of_birth = new Date(parsedDate);
          }
          // Tag
          if (header.includes('tag') || header.includes('oznaka')) {
            userData.tag = value;
          }
          // Uloga
          if (header.includes('role') || header.includes('uloga')) {
            userData.role = value.toLowerCase().includes('admin') ? 'admin' : 'employee';
          }
          // Privremena lozinka
          if (header.includes('password') || header.includes('lozinka')) {
            if (value.length >= 6) {
              userData.password = value;
            }
          }
        });
        
        return userData;
      }).filter(user => user.full_name && user.email);

      for (const userData of usersToImport) {
        await createUser(userData);
      }
      
      setCsvFile(null);
      toast({ title: "Uspeh", description: `Uvezeno je ${usersToImport.length} korisnika` });
    } catch (error) {
      console.error('Error importing users:', error);
      toast({ title: "Greška", description: "Greška pri uvozu korisnika", variant: "destructive" });
    }
  };

  // Mobile combined search state
  const [mobileSearch, setMobileSearch] = useState('');

  const filteredUsers = users.filter(user => {
    // On mobile, use combined search across name and ID
    if (isMobile && mobileSearch) {
      const lowerSearch = mobileSearch.toLowerCase();
      const matchesMobileSearch = 
        (user.full_name && user.full_name.toLowerCase().includes(lowerSearch)) ||
        (user.company_card_id && user.company_card_id.toLowerCase().includes(lowerSearch)) ||
        (user.email && user.email.toLowerCase().includes(lowerSearch));
      if (!matchesMobileSearch) return false;
    }

    const matchesId = !userFilters.id || 
      (user.company_card_id && user.company_card_id.toLowerCase().includes(userFilters.id.toLowerCase()));
    const matchesName = !userFilters.fullName || 
      (user.full_name && user.full_name.toLowerCase().includes(userFilters.fullName.toLowerCase()));
    const matchesEmail = !userFilters.email || 
      (user.email && user.email.toLowerCase().includes(userFilters.email.toLowerCase()));
    const matchesTag = userFilters.tag === '' || 
      (userFilters.tag === '__none__' ? (!user.tag || user.tag.trim() === '') : user.tag === userFilters.tag);
    const matchesPhone = !userFilters.phone || 
      (user.phone && user.phone.includes(userFilters.phone));
    const matchesDob = !userFilters.dateOfBirth || 
      (user.date_of_birth && user.date_of_birth.includes(userFilters.dateOfBirth));
    const matchesRole = userFilters.role === 'all' || user.role === userFilters.role;
    
    return matchesId && matchesName && matchesEmail && matchesTag && matchesPhone && matchesDob && matchesRole;
  });

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSet = new Set(selectedUserIds);
    if (checked) {
      newSet.add(userId);
    } else {
      newSet.delete(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleBulkTagUpdate = async () => {
    if (selectedUserIds.size === 0) return;
    
    setBulkUpdating(true);
    try {
      const updatePromises = Array.from(selectedUserIds).map(userId => 
        updateUser(userId, { tag: bulkTagValue || null })
      );
      await Promise.all(updatePromises);
      
      toast({
        title: 'Uspeh',
        description: `Tag je ažuriran za ${selectedUserIds.size} korisnika`
      });
      
      setSelectedUserIds(new Set());
      setBulkTagDialogOpen(false);
      setBulkTagValue("");
    } catch (error) {
      console.error('Bulk update error:', error);
      toast({
        title: 'Greška',
        description: 'Došlo je do greške pri masovnom ažuriranju',
        variant: 'destructive'
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;
    
    setBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const userId of Array.from(selectedUserIds)) {
      try {
        await deleteUser(userId);
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to delete user ${userId}:`, error);
      }
    }
    
    if (failCount > 0) {
      toast({
        title: 'Delimičan uspeh',
        description: `Obrisano: ${successCount}, neuspešno: ${failCount}`,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Uspeh',
        description: `Obrisano je ${successCount} korisnika`
      });
    }
    
    setSelectedUserIds(new Set());
    setBulkDeleteDialogOpen(false);
    setBulkDeleting(false);
  };

  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id));
  const isSomeSelected = selectedUserIds.size > 0;

  // Get unique existing tags from all users
  const existingTags = useMemo(() => {
    const tags = users
      .map(u => u.tag)
      .filter((tag): tag is string => !!tag && tag.trim() !== '');
    return [...new Set(tags)].sort();
  }, [users]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  Upravljanje korisnicima
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">Pregled svih registrovanih korisnika</CardDescription>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <input 
                ref={csvInputRef} 
                type="file" 
                accept=".csv,.xlsx" 
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) setCsvFile(file);
                }} 
                className="hidden" 
              />
              <Button variant="outline" onClick={handleDownloadTemplate} className="w-full md:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Preuzmi template
              </Button>
              <Button variant="outline" onClick={() => csvInputRef.current?.click()} className="w-full md:w-auto">
                <FileText className="h-4 w-4 mr-2" />
                Uvezi CSV/XLSX
              </Button>
              {csvFile && (
                <div className="flex items-center gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full md:w-auto">
                        <Upload className="h-4 w-4 mr-2" />
                        Uvezi ({csvFile.name})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Potvrdi uvoz</AlertDialogTitle>
                        <AlertDialogDescription>
                          Da li ste sigurni da želite da uvezete korisnike iz fajla {csvFile.name}? 
                          CSV mora imati kolone: Ime i prezime, Email. 
                          Opciono: ID, Telefon, Datum rođenja, Uloga, Privremena lozinka.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Otkaži</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkUserImport}>Uvezi</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleClearFile}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    title="Ukloni fajl"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <SheetTrigger asChild>
                  <Button onClick={() => { resetUserForm(); setShowCustomTagInput(false); setIsAddUserOpen(true); }} className="w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Dodaj korisnika
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full md:max-w-lg overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Dodaj novog korisnika</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="user-name">Ime i prezime *</Label>
                      <Input 
                        id="user-name" 
                        value={userForm.full_name} 
                        onChange={e => setUserForm({ ...userForm, full_name: e.target.value })} 
                        placeholder="Marko Marković" 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="user-email">Email *</Label>
                      <Input 
                        id="user-email" 
                        type="email" 
                        value={userForm.email} 
                        onChange={e => setUserForm({ ...userForm, email: e.target.value })} 
                        placeholder="marko@example.com" 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="user-phone">Telefon</Label>
                      <Input 
                        id="user-phone" 
                        value={userForm.phone} 
                        onChange={e => setUserForm({ ...userForm, phone: e.target.value })} 
                        placeholder="069123456" 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="user-id">ID *</Label>
                      <Input 
                        id="user-id" 
                        type="text"
                        pattern="[0-9]*"
                        maxLength={10}
                        value={userForm.company_card_id} 
                        onChange={e => {
                          const value = e.target.value.replace(/\D/g, '');
                          setUserForm({ ...userForm, company_card_id: value });
                        }}
                        placeholder="1234567890"
                        className={!userForm.company_card_id ? 'border-destructive' : ''}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Identifikacioni broj korisnika (max 10 cifara)
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="user-tag">Tag</Label>
                      {showCustomTagInput ? (
                        <div className="flex gap-2">
                          <Input 
                            id="user-tag" 
                            value={userForm.tag} 
                            onChange={e => setUserForm({ ...userForm, tag: e.target.value })} 
                            placeholder="Unesite novi tag" 
                            autoFocus
                          />
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="icon"
                            onClick={() => {
                              setShowCustomTagInput(false);
                              setUserForm({ ...userForm, tag: "" });
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select 
                          value={userForm.tag || "__none__"} 
                          onValueChange={(value) => {
                            if (value === "__custom__") {
                              setShowCustomTagInput(true);
                              setUserForm({ ...userForm, tag: "" });
                            } else if (value === "__none__") {
                              setUserForm({ ...userForm, tag: "" });
                            } else {
                              setUserForm({ ...userForm, tag: value });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Odaberite tag" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">(Bez taga)</SelectItem>
                            {existingTags.map(tag => (
                              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">+ Novi tag...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Oznaka za kategorizaciju korisnika
                      </p>
                    </div>
                    
                    <div>
                      <Label>Datum rođenja</Label>
                      <EnhancedDatePicker
                        date={userForm.date_of_birth}
                        onDateChange={(date) => setUserForm({ ...userForm, date_of_birth: date })}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        placeholder="Izaberite datum"
                      />
                    </div>
                    
                    <div>
                      <Label>Uloga</Label>
                      <Select 
                        value={userForm.role} 
                        onValueChange={(value: Role) => setUserForm({ ...userForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Odaberite ulogu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Zaposleni</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="use-password" 
                          checked={!userForm.usePassword}
                          onCheckedChange={(checked) => setUserForm({
                            ...userForm,
                            usePassword: checked !== true,
                            password: checked !== true ? generateTemporaryPassword() : ""
                          })}
                        />
                        <Label htmlFor="use-password" className="text-sm cursor-pointer">
                          Koristi email pozivnicu
                        </Label>
                      </div>
                      
                      {userForm.usePassword && (
                        <div>
                          <Label htmlFor="user-password">Privremena lozinka</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="user-password" 
                              type="text" 
                              value={userForm.password} 
                              onChange={e => setUserForm({ ...userForm, password: e.target.value })} 
                              placeholder="Minimum 6 karaktera"
                              className="font-mono"
                            />
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={() => setUserForm({ ...userForm, password: generateTemporaryPassword() })}
                            >
                              Nova
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Zabeležite ovu lozinku i prosledite je korisniku
                          </p>
                          {userForm.password && userForm.password.length < 6 && (
                            <p className="text-xs text-destructive mt-1">Lozinka mora imati najmanje 6 karaktera</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <Button onClick={handleCreateUser} className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Kreiranje u toku...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          {userForm.usePassword ? 'Kreiraj korisnika' : 'Kreiraj i pošalji pozivnicu'}
                        </>
                      )}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions Bar */}
          {isSomeSelected && (
            <div className="mb-4 p-3 bg-primary/10 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Izabrano: {selectedUserIds.size} korisnika
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertDialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Tag className="h-4 w-4 mr-2" />
                      Izmeni Tag
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Masovna izmena Tag-a</AlertDialogTitle>
                      <AlertDialogDescription>
                        Unesite novu vrednost Tag-a za {selectedUserIds.size} izabranih korisnika. 
                        Ostavite prazno da uklonite Tag.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="bulk-tag">Novi Tag</Label>
                      <Input
                        id="bulk-tag"
                        value={bulkTagValue}
                        onChange={(e) => setBulkTagValue(e.target.value)}
                        placeholder="npr. VIP, Probni, Marketing"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkTagUpdate} disabled={bulkUpdating}>
                        {bulkUpdating ? 'Ažuriranje...' : 'Primeni'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši izabrane
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Masovno brisanje korisnika</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da obrišete {selectedUserIds.size} izabranih korisnika? 
                        Ova akcija je nepovratna i briše sve podatke korisnika uključujući narudžbine i profil.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={bulkDeleting}>Otkaži</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBulkDelete} 
                        disabled={bulkDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {bulkDeleting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Brisanje...
                          </>
                        ) : `Obriši ${selectedUserIds.size} korisnika`}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedUserIds(new Set())}
                >
                  <X className="h-4 w-4 mr-1" />
                  Poništi
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">Učitavanje...</div>
           ) : (
            <>
              {isMobile ? (
                /* Mobile card view */
                <div className="space-y-2">
                  {/* Mobile search */}
                  <Input
                    placeholder="Pretraži po imenu, ID-u ili email-u..."
                    value={mobileSearch}
                    onChange={(e) => { setMobileSearch(e.target.value); setUsersPage(1); }}
                    className="h-9 text-sm"
                  />
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">Nema korisnika koji odgovaraju filterima</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers
                        .slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize)
                        .map(user => (
                        <div
                          key={user.id}
                          className="p-3 border rounded-lg bg-card cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedUser({...user})}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm">{user.full_name || '-'}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                                {user.role === 'admin' ? 'Admin' : 'Zaposleni'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInviteDialogUser(user);
                                }}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            {user.company_card_id && (
                              <span className="font-mono">ID: {user.company_card_id}</span>
                            )}
                            {user.tag && (
                              <Badge variant="secondary" className="text-xs h-5">{user.tag}</Badge>
                            )}
                            {user.phone && <span>{user.phone}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Desktop table view */
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) => handleSelectAll(checked === true)}
                            aria-label="Izaberi sve"
                          />
                        </TableHead>
                        <TableHead className="w-[100px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">ID</span>
                            <Input
                              placeholder="Pretraži..."
                              value={userFilters.id}
                              onChange={(e) => { setUserFilters(prev => ({...prev, id: e.target.value})); setUsersPage(1); }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Ime i prezime</span>
                            <Input
                              placeholder="Pretraži..."
                              value={userFilters.fullName}
                              onChange={(e) => { setUserFilters(prev => ({...prev, fullName: e.target.value})); setUsersPage(1); }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </TableHead>
                        <TableHead>
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Email</span>
                            <Input
                              placeholder="Pretraži..."
                              value={userFilters.email}
                              onChange={(e) => { setUserFilters(prev => ({...prev, email: e.target.value})); setUsersPage(1); }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </TableHead>
                        <TableHead className="w-[110px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Tag</span>
                            <Select 
                              value={userFilters.tag} 
                              onValueChange={(value) => { setUserFilters(prev => ({...prev, tag: value === 'all' ? '' : value})); setUsersPage(1); }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Svi</SelectItem>
                                <SelectItem value="__none__">Bez taga</SelectItem>
                                {existingTags.map(tag => (
                                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead className="w-[120px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Telefon</span>
                            <Input
                              placeholder="Pretraži..."
                              value={userFilters.phone}
                              onChange={(e) => { setUserFilters(prev => ({...prev, phone: e.target.value})); setUsersPage(1); }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </TableHead>
                        <TableHead className="w-[120px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Datum rođenja</span>
                            <Input
                              placeholder="Pretraži..."
                              value={userFilters.dateOfBirth}
                              onChange={(e) => { setUserFilters(prev => ({...prev, dateOfBirth: e.target.value})); setUsersPage(1); }}
                              className="h-7 text-xs"
                            />
                          </div>
                        </TableHead>
                        <TableHead className="w-[120px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-xs">Uloga</span>
                            <Select 
                              value={userFilters.role} 
                              onValueChange={(value) => { setUserFilters(prev => ({...prev, role: value})); setUsersPage(1); }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Svi</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="employee">Zaposleni</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableHead>
                        <TableHead className="w-[60px]">
                          <span className="font-semibold text-xs">Akcije</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            Nema korisnika koji odgovaraju filterima
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers
                          .slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize)
                          .map(user => (
                          <TableRow 
                            key={user.id}
                            className={`cursor-pointer hover:bg-muted/50 ${selectedUserIds.has(user.id) ? 'bg-primary/5' : ''}`}
                            onClick={() => setSelectedUser({...user})}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedUserIds.has(user.id)}
                                onCheckedChange={(checked) => handleSelectUser(user.id, checked === true)}
                                aria-label={`Izaberi ${user.full_name}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">
                              {user.company_card_id || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                            <TableCell className="text-sm">
                              {user.tag ? (
                                <Badge 
                                  variant="secondary" 
                                  className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUserFilters(prev => ({ ...prev, tag: user.tag || '' }));
                                  }}
                                >
                                  {user.tag}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-sm">{user.phone || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {user.date_of_birth ? format(new Date(user.date_of_birth), 'dd.MM.yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                                {user.role === 'admin' ? 'Admin' : 'Zaposleni'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInviteDialogUser(user);
                                }}
                                title="Pošalji pozivnicu"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {filteredUsers.length > 0 && (
                <TablePagination
                  currentPage={usersPage}
                  totalItems={filteredUsers.length}
                  pageSize={usersPageSize}
                  onPageChange={setUsersPage}
                  onPageSizeChange={(size) => { setUsersPageSize(size); setUsersPage(1); }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit User Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null);
          setResetPasswordForm({ newPassword: "", confirmPassword: "", isOpen: false });
          setShowEditCustomTagInput(false);
        }
      }}>
        <SheetContent className="w-full md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Izmeni korisnika</SheetTitle>
          </SheetHeader>
          {selectedUser && (
            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="edit-user-name">Ime i prezime</Label>
                <Input 
                  id="edit-user-name" 
                  value={selectedUser.full_name || ''} 
                  onChange={e => setSelectedUser({ ...selectedUser, full_name: e.target.value })} 
                  placeholder="Marko Marković" 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-user-email">Email</Label>
                <Input 
                  id="edit-user-email" 
                  type="email" 
                  value={selectedUser.email || ''} 
                  onChange={e => setSelectedUser({ ...selectedUser, email: e.target.value })} 
                  placeholder="marko@example.com" 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-user-phone">Telefon</Label>
                <Input 
                  id="edit-user-phone" 
                  value={selectedUser.phone || ''} 
                  onChange={e => setSelectedUser({ ...selectedUser, phone: e.target.value })} 
                  placeholder="069123456" 
                />
              </div>
              
              <div>
                <Label htmlFor="edit-user-id">ID *</Label>
                <Input 
                  id="edit-user-id" 
                  type="text"
                  pattern="[0-9]*"
                  maxLength={10}
                  value={selectedUser.company_card_id || ''} 
                  onChange={e => {
                    const value = e.target.value.replace(/\D/g, '');
                    setSelectedUser({ ...selectedUser, company_card_id: value });
                  }}
                  placeholder="1234567890"
                  className={!selectedUser.company_card_id ? 'border-destructive' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Identifikacioni broj korisnika (max 10 cifara)
                </p>
                {!selectedUser.company_card_id && (
                  <p className="text-xs text-destructive mt-1">ID je obavezno polje</p>
                )}
              </div>
              
               <div>
                 <Label htmlFor="edit-user-tag">Tag</Label>
                 {showEditCustomTagInput ? (
                   <div className="flex gap-2">
                     <Input 
                       id="edit-user-tag" 
                       value={selectedUser.tag || ''} 
                       onChange={e => setSelectedUser({ ...selectedUser, tag: e.target.value })} 
                       placeholder="Unesite novi tag" 
                       autoFocus
                     />
                     <Button 
                       type="button" 
                       variant="outline" 
                       size="icon"
                       onClick={() => {
                         setShowEditCustomTagInput(false);
                         setSelectedUser({ ...selectedUser, tag: '' });
                       }}
                     >
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
                 ) : (
                   <Select 
                     value={selectedUser.tag || "__none__"} 
                     onValueChange={(value) => {
                       if (value === "__custom__") {
                         setShowEditCustomTagInput(true);
                         setSelectedUser({ ...selectedUser, tag: '' });
                       } else if (value === "__none__") {
                         setSelectedUser({ ...selectedUser, tag: '' });
                       } else {
                         setSelectedUser({ ...selectedUser, tag: value });
                       }
                     }}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Odaberite tag" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="__none__">(Bez taga)</SelectItem>
                       {existingTags.map(tag => (
                         <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                       ))}
                       <SelectItem value="__custom__">+ Novi tag...</SelectItem>
                     </SelectContent>
                   </Select>
                 )}
                 <p className="text-xs text-muted-foreground mt-1">
                   Oznaka za kategorizaciju korisnika
                 </p>
               </div>

               <div>
                 <Label>Datum rođenja</Label>
                 <EnhancedDatePicker
                   date={selectedUser.date_of_birth ? new Date(selectedUser.date_of_birth) : undefined}
                  onDateChange={(date) => setSelectedUser({
                    ...selectedUser,
                    date_of_birth: date ? format(date, 'yyyy-MM-dd') : null
                  })}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  placeholder="Izaberite datum"
                />
              </div>
              
              <div>
                <Label>Uloga</Label>
                <Select 
                  value={selectedUser.role || 'employee'} 
                  onValueChange={async (value: 'admin' | 'employee') => {
                    if (value === selectedUser.role) return;
                    setChangingRole(true);
                    try {
                      await changeUserRole(selectedUser.id, selectedUser.user_id, value);
                      setSelectedUser({ ...selectedUser, role: value });
                    } catch (error) {
                      console.error('Error changing role:', error);
                    } finally {
                      setChangingRole(false);
                    }
                  }}
                  disabled={changingRole}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Odaberite ulogu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Zaposleni</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                {changingRole && (
                  <p className="text-xs text-muted-foreground mt-1">Menjanje uloge...</p>
                )}
              </div>
              
              <div className="space-y-2 pt-4 border-t">
                <p className="text-sm font-medium">Resetuj lozinku</p>
                <div className="space-y-2">
                  <Input 
                    type="password" 
                    placeholder="Nova lozinka (min 6 karaktera)"
                    value={resetPasswordForm.newPassword}
                    onChange={(e) => setResetPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                  <Input 
                    type="password" 
                    placeholder="Potvrdi novu lozinku"
                    value={resetPasswordForm.confirmPassword}
                    onChange={(e) => setResetPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        disabled={!resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 6 || resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword}
                      >
                        <Key className="h-4 w-4 mr-2" />
                        Resetuj lozinku
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Potvrdi reset lozinke</AlertDialogTitle>
                        <AlertDialogDescription>
                          Da li ste sigurni da želite da resetujete lozinku za korisnika {selectedUser.full_name || selectedUser.email}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Otkaži</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                          try {
                            await resetUserPassword(selectedUser.user_id, resetPasswordForm.newPassword);
                            setResetPasswordForm({ newPassword: "", confirmPassword: "", isOpen: false });
                          } catch (error) {
                            console.error('Error resetting password:', error);
                          }
                        }}>
                          Resetuj
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {resetPasswordForm.newPassword && resetPasswordForm.newPassword.length < 6 && (
                    <p className="text-xs text-destructive">Lozinka mora imati najmanje 6 karaktera</p>
                  )}
                  {resetPasswordForm.newPassword && resetPasswordForm.confirmPassword && resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword && (
                    <p className="text-xs text-destructive">Lozinke se ne poklapaju</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={updatingUser}>
                      {updatingUser ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Čuvanje u toku...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Sačuvaj izmene
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi izmene</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da sačuvate izmene za ovog korisnika?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={updatingUser}>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUpdateUser} disabled={updatingUser}>
                        {updatingUser ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Čuvanje...
                          </>
                        ) : (
                          'Sačuvaj'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Obriši korisnika
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Potvrdi brisanje</AlertDialogTitle>
                      <AlertDialogDescription>
                        Da li ste sigurni da želite da obrišete ovog korisnika? Ova akcija se ne može poništiti.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Otkaži</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => {
                        await deleteUser(selectedUser.id);
                        setSelectedUser(null);
                      }}>
                        Obriši
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Send Invitation Dialog */}
      <SendInvitationDialog
        user={inviteDialogUser}
        open={!!inviteDialogUser}
        onOpenChange={(open) => !open && setInviteDialogUser(null)}
        onSendMagicLink={sendMagicLink}
        onSendCredentials={sendInvitationWithCredentials}
      />
    </>
  );
}
