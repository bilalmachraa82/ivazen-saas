import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPartners, useIsAdmin, Partner, PartnerFormData } from "@/hooks/useAdminPartners";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Upload, X, ExternalLink, ImageIcon, Shield } from "lucide-react";

const AdminPartners = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user?.id);
  const {
    partners,
    isLoading,
    createPartner,
    updatePartner,
    deletePartner,
    toggleActive,
    uploadLogo,
    isCreating,
    isUpdating,
  } = useAdminPartners();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>({
    name: "",
    initials: "",
    website_url: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not admin
  if (!authLoading && !roleLoading && !isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Shield className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Acesso Restrito</h1>
          <p className="text-muted-foreground">Apenas administradores podem aceder a esta página.</p>
          <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const resetForm = () => {
    setFormData({ name: "", initials: "", website_url: "" });
    setLogoFile(null);
    setLogoPreview(null);
    setEditingPartner(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      initials: partner.initials,
      website_url: partner.website_url || "",
    });
    setLogoPreview(partner.logo_url);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const removeLogoPreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const generateInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      initials: prev.initials || generateInitials(name),
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.initials) return;

    try {
      let logoUrl = editingPartner?.logo_url || null;

      if (editingPartner) {
        // Update existing partner
        if (logoFile) {
          logoUrl = await uploadLogo(logoFile, editingPartner.id);
        }
        await updatePartner({
          id: editingPartner.id,
          data: { ...formData, logo_url: logoPreview ? logoUrl : null },
        });
      } else {
        // Create new partner
        const newPartner = await createPartner(formData);
        if (logoFile && newPartner?.id) {
          logoUrl = await uploadLogo(logoFile, newPartner.id);
          await updatePartner({ id: newPartner.id, data: { logo_url: logoUrl } });
        }
      }

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving partner:", error);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePartner(id);
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    await toggleActive({ id, is_active: !currentState });
  };

  if (authLoading || roleLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Parceiros</h1>
            <p className="text-muted-foreground">Adicione, edite e gira os parceiros exibidos na landing page.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Parceiro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPartner ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Nome do parceiro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initials">Iniciais *</Label>
                  <Input
                    id="initials"
                    value={formData.initials}
                    onChange={(e) => setFormData({ ...formData, initials: e.target.value.toUpperCase() })}
                    placeholder="Ex: SA"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website (opcional)</Label>
                  <Input
                    id="website"
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    placeholder="https://exemplo.pt"
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo (opcional)</Label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Preview"
                          className="h-16 w-16 rounded-lg object-cover border"
                        />
                        <button
                          type="button"
                          onClick={removeLogoPreview}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={isCreating || isUpdating || !formData.name || !formData.initials}>
                  {editingPartner ? "Guardar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Parceiros ({partners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {partners.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum parceiro encontrado.</p>
                <p className="text-sm">Clique em "Novo Parceiro" para adicionar o primeiro.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Logo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Website</TableHead>
                    <TableHead className="w-20 text-center">Ordem</TableHead>
                    <TableHead className="w-20 text-center">Activo</TableHead>
                    <TableHead className="w-24 text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((partner) => (
                    <TableRow key={partner.id} className={!partner.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        {partner.logo_url ? (
                          <img
                            src={partner.logo_url}
                            alt={partner.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                            {partner.initials}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {partner.website_url ? (
                          <a
                            href={partner.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{partner.website_url.replace(/^https?:\/\//, "")}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{partner.display_order}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={partner.is_active ?? false}
                          onCheckedChange={() => handleToggleActive(partner.id, partner.is_active ?? false)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(partner)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar parceiro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acção não pode ser revertida. O parceiro "{partner.name}" será permanentemente eliminado.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(partner.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminPartners;
