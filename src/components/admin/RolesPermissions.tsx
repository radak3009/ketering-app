import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ShieldCheck, Save, RotateCcw } from "lucide-react";

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  panel: "admin" | "employee";
  is_system: boolean;
  is_demo: boolean;
}
interface Permission {
  key: string;
  group_key: string;
  label: string;
  description: string | null;
  sort_order: number;
}
interface RolePermission {
  role_id: string;
  permission_key: string;
  allowed: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Kontrolna tabla",
  orders: "Porudžbine",
  meals: "Obroci",
  menus: "Jelovnici",
  users: "Korisnici",
  feedback: "Povratne informacije",
  notifications: "Obaveštenja",
  reports: "Izveštaji",
  settings: "Postavke",
  self: "Zaposleni (self-service)",
};

export function RolesPermissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Map<string, boolean>>(new Map()); // key = role_id|perm_key
  const [original, setOriginal] = useState<Map<string, boolean>>(new Map());
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Create-role dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPanel, setNewPanel] = useState<"admin" | "employee">("admin");
  const [newCopyFrom, setNewCopyFrom] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { op: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRoles(data.roles ?? []);
      setPermissions(data.permissions ?? []);
      const m = new Map<string, boolean>();
      (data.role_permissions ?? []).forEach((rp: RolePermission) => {
        m.set(`${rp.role_id}|${rp.permission_key}`, rp.allowed);
      });
      setMatrix(m);
      setOriginal(new Map(m));
      if (!selectedRoleId && data.roles?.length) {
        setSelectedRoleId(data.roles[0].id);
      }
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    permissions.forEach((p) => {
      g[p.group_key] = g[p.group_key] || [];
      g[p.group_key].push(p);
    });
    return g;
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  const dirty = useMemo(() => {
    if (!selectedRoleId) return false;
    for (const p of permissions) {
      const k = `${selectedRoleId}|${p.key}`;
      if ((matrix.get(k) ?? false) !== (original.get(k) ?? false)) return true;
    }
    return false;
  }, [matrix, original, selectedRoleId, permissions]);

  const togglePerm = (permKey: string, value: boolean) => {
    if (!selectedRoleId) return;
    const next = new Map(matrix);
    next.set(`${selectedRoleId}|${permKey}`, value);
    setMatrix(next);
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const payload = permissions.map((p) => ({
        key: p.key,
        allowed: matrix.get(`${selectedRoleId}|${p.key}`) ?? false,
      }));
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { op: "set_permissions", role_id: selectedRoleId, permissions: payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Sačuvano", description: "Dozvole su ažurirane." });
      setOriginal(new Map(matrix));
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setMatrix(new Map(original));
  };

  const handleCreate = async () => {
    if (!newKey || !newName) {
      toast({ title: "Greška", description: "Ključ i naziv su obavezni.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          op: "create_role",
          key: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          panel: newPanel,
          copy_from_role_id: newCopyFrom || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Uspeh", description: "Uloga je kreirana." });
      setCreateOpen(false);
      setNewKey(""); setNewName(""); setNewDesc(""); setNewPanel("admin"); setNewCopyFrom("");
      await load();
      await queryClient.invalidateQueries({ queryKey: ["roles-catalog"] });
      setSelectedRoleId(data.role.id);
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole || selectedRole.is_system) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: { op: "delete_role", role_id: selectedRole.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Obrisano", description: `Uloga "${selectedRole.name}" je obrisana.` });
      setSelectedRoleId(null);
      await load();
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      {/* Roles list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Uloge</CardTitle>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Dodaj
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova uloga</DialogTitle>
                  <DialogDescription>Kreiraj novu ulogu i opciono kopiraj dozvole.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Ključ (interni)</Label>
                    <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="npr. magacioner" />
                  </div>
                  <div>
                    <Label>Naziv</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="npr. Magacioner" />
                  </div>
                  <div>
                    <Label>Opis</Label>
                    <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
                  </div>
                  <div>
                    <Label>Panel</Label>
                    <Select value={newPanel} onValueChange={(v) => setNewPanel(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin panel</SelectItem>
                        <SelectItem value="employee">Employee panel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kopiraj dozvole od (opciono)</Label>
                    <Select value={newCopyFrom} onValueChange={setNewCopyFrom}>
                      <SelectTrigger><SelectValue placeholder="Bez kopiranja" /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>Otkaži</Button>
                  <Button onClick={handleCreate}>Kreiraj</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedRoleId === r.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.name}</span>
                  <div className="flex gap-1">
                    {r.is_system && <Badge variant="secondary" className="text-[10px]">Sistemska</Badge>}
                    {r.is_demo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">{r.description ?? r.key}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permissions matrix */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {selectedRole?.name ?? "Izaberi ulogu"}
              </CardTitle>
              <CardDescription>{selectedRole?.description ?? ""}</CardDescription>
            </div>
            {selectedRole && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleRevert} disabled={!dirty || saving}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Vrati
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Sačuvaj
                </Button>
                {!selectedRole.is_system && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Obriši ulogu?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ova akcija je nepovratna. Uloga „{selectedRole.name}" će biti obrisana.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Otkaži</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRole}>Obriši</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedRole ? (
            <p className="text-sm text-muted-foreground">Izaberi ulogu sa leve strane.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([group, perms]) => (
                <div key={group}>
                  <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                    {GROUP_LABELS[group] ?? group}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {perms.map((p) => {
                      const k = `${selectedRole.id}|${p.key}`;
                      const value = matrix.get(k) ?? false;
                      return (
                        <div
                          key={p.key}
                          className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                        >
                          <div className="min-w-0">
                            <Label htmlFor={k} className="text-sm font-medium cursor-pointer">
                              {p.label}
                            </Label>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">{p.key}</p>
                          </div>
                          <Switch
                            id={k}
                            checked={value}
                            onCheckedChange={(v) => togglePerm(p.key, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
