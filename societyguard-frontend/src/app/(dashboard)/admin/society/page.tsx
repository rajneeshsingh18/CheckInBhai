"use client";

import { useState } from "react";
import {
  useTowers,
  useCreateTower,
  useUpdateTower,
  useDeleteTower,
  useCreateFlat,
  useUpdateFlat,
  useDeleteFlat,
  useAssignResident,
  useBulkImportFlats
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  Upload,
  Building2,
  Home,
  Users,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

export default function TowersAndFlats() {
  const { data: towers = [], isLoading, refetch } = useTowers();

  // Mutations
  const createTower = useCreateTower();
  const updateTower = useUpdateTower();
  const deleteTower = useDeleteTower();
  
  const createFlat = useCreateFlat();
  const updateFlat = useUpdateFlat();
  const deleteFlat = useDeleteFlat();
  
  const assignResident = useAssignResident();
  const bulkImport = useBulkImportFlats();

  // States
  const [towerName, setTowerName] = useState("");
  const [editingTower, setEditingTower] = useState<any>(null);
  const [deletingTowerId, setDeletingTowerId] = useState<string | null>(null);
  const [towerModalOpen, setTowerModalOpen] = useState(false);

  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [flatNumber, setFlatNumber] = useState("");
  const [flatFloor, setFlatFloor] = useState("");
  const [editingFlat, setEditingFlat] = useState<any>(null);
  const [deletingFlatId, setDeletingFlatId] = useState<string | null>(null);
  const [flatModalOpen, setFlatModalOpen] = useState(false);

  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [residentEmail, setResidentEmail] = useState("");
  const [residentName, setResidentName] = useState("");
  const [residentMobile, setResidentMobile] = useState("");
  const [residentModalOpen, setResidentModalOpen] = useState(false);
  const [expandedTowerId, setExpandedTowerId] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFileText, setBulkFileText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);

  // Tower Actions
  const handleTowerSubmit = async () => {
    if (!towerName.trim()) return;
    if (editingTower) {
      await updateTower.mutateAsync({ id: editingTower.id, name: towerName });
    } else {
      await createTower.mutateAsync(towerName);
    }
    setTowerModalOpen(false);
    setTowerName("");
    setEditingTower(null);
    refetch();
  };

  const handleDeleteTower = async () => {
    if (!deletingTowerId) return;
    await deleteTower.mutateAsync(deletingTowerId);
    setDeletingTowerId(null);
    refetch();
  };

  // Flat Actions
  const handleFlatSubmit = async () => {
    if (!flatNumber.trim()) return;
    if (editingFlat) {
      await updateFlat.mutateAsync({
        id: editingFlat.id,
        flatData: { number: flatNumber, floor: flatFloor ? parseInt(flatFloor) : undefined }
      });
    } else if (selectedTowerId) {
      await createFlat.mutateAsync({
        number: flatNumber,
        floor: flatFloor ? parseInt(flatFloor) : undefined,
        towerId: selectedTowerId
      });
    }
    setFlatModalOpen(false);
    setFlatNumber("");
    setFlatFloor("");
    setEditingFlat(null);
    setSelectedTowerId(null);
    refetch();
  };

  const handleDeleteFlat = async () => {
    if (!deletingFlatId) return;
    await deleteFlat.mutateAsync(deletingFlatId);
    setDeletingFlatId(null);
    refetch();
  };

  // Resident Assignment
  const handleAssignResident = async () => {
    if (!residentEmail.trim() || !residentName.trim() || !selectedFlatId) return;
    await assignResident.mutateAsync({
      email: residentEmail,
      name: residentName,
      mobile: residentMobile || undefined,
      flatId: selectedFlatId
    });
    setResidentModalOpen(false);
    setResidentEmail("");
    setResidentName("");
    setResidentMobile("");
    setSelectedFlatId(null);
    refetch();
  };

  // CSV Parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setBulkFileText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const lines = text.split("\n");
    const rows = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",");
      if (parts.length >= 2) {
        rows.push({
          towerName: parts[0].trim(),
          flatNumber: parts[1].trim(),
          floor: parts[2] ? parseInt(parts[2].trim()) : undefined
        });
      }
    }
    setParsedRows(rows);
    toast.success(`Parsed ${rows.length} rows from file`);
  };

  const handleBulkSubmit = async () => {
    if (parsedRows.length === 0) {
      toast.error("No valid rows parsed");
      return;
    }
    await bulkImport.mutateAsync(parsedRows);
    setBulkOpen(false);
    setBulkFileText("");
    setParsedRows([]);
    refetch();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Towers & Flats</h1>
          <p className="text-gray-500 mt-1">Configure society structures and resident assignments.</p>
        </div>
        <div className="flex space-x-2 shrink-0">
          <Button
            onClick={() => setBulkOpen(true)}
            variant="outline"
            className="border-gray-300 font-semibold bg-white text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4 mr-2" /> Bulk Import
          </Button>
          <Button
            onClick={() => {
              setEditingTower(null);
              setTowerName("");
              setTowerModalOpen(true);
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Tower
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Card className="border border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold text-gray-900">Registered Towers</CardTitle>
          <CardDescription>Expand each tower to view flats, floor mapping, and residents</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            </div>
          ) : towers.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No towers registered yet. Create a tower to get started.</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {towers.map((tower: any) => {
                const isExpanded = expandedTowerId === tower.id;
                return (
                  <div
                    key={tower.id}
                    className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between px-4 py-1 bg-gray-50/10 border-b border-gray-100">
                      <button
                        type="button"
                        onClick={() => setExpandedTowerId(isExpanded ? null : tower.id)}
                        className="flex-grow flex items-center justify-between font-bold text-gray-900 py-3 text-left focus:outline-none"
                      >
                        <span className="flex items-center">
                          <Building2 className="w-4 h-4 mr-2.5 text-orange-600" />
                          Tower {tower.name}{" "}
                          <span className="text-xs font-normal text-gray-400 ml-2">
                            ({tower.flats?.length || 0} Flats)
                          </span>
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 mr-2" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 mr-2" />
                        )}
                      </button>
                      
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 rounded-full text-orange-600 hover:bg-orange-50"
                          title="Add Flat"
                          onClick={() => {
                            setSelectedTowerId(tower.id);
                            setEditingFlat(null);
                            setFlatNumber("");
                            setFlatFloor("");
                            setFlatModalOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-100"
                          onClick={() => {
                            setEditingTower(tower);
                            setTowerName(tower.name);
                            setTowerModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50"
                          onClick={() => setDeletingTowerId(tower.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {tower.flats?.length === 0 ? (
                            <div className="col-span-full py-6 text-center text-xs text-gray-400 italic">
                              No flats registered under this tower.
                            </div>
                          ) : (
                            tower.flats.map((flat: any) => (
                              <div
                                key={flat.id}
                                className="border border-gray-200 rounded-xl p-4 bg-gray-50/30 flex flex-col justify-between shadow-sm relative group hover:border-gray-300 transition-colors"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-gray-900 text-sm flex items-center">
                                      <Home className="w-4 h-4 mr-1.5 text-gray-400" />
                                      Flat {flat.number}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-white">
                                      Floor: {flat.floor ?? "N/A"}
                                    </Badge>
                                  </div>

                                  {/* Residents details */}
                                  <div className="mt-3.5 space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center">
                                      <Users className="w-3 h-3 mr-1" /> Residents
                                    </div>
                                    {flat.residents?.length === 0 ? (
                                      <span className="text-xs text-gray-400 italic block">No residents assigned</span>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {flat.residents.map((r: any) => (
                                          <div key={r.id} className="text-xs">
                                            <p className="font-bold text-gray-900">{r.user.name}</p>
                                            <p className="text-[10px] text-gray-500">{r.user.email}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Flat Action Buttons */}
                                <div className="flex items-center space-x-1.5 mt-4 pt-3 border-t border-gray-100">
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="flex-1 text-[11px] border-orange-200 text-orange-700 hover:bg-orange-50 font-semibold"
                                    onClick={() => {
                                      setSelectedFlatId(flat.id);
                                      setResidentModalOpen(true);
                                    }}
                                  >
                                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign Resident
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-7 h-7 text-gray-500 hover:bg-gray-100"
                                    onClick={() => {
                                      setEditingFlat(flat);
                                      setFlatNumber(flat.number);
                                      setFlatFloor(flat.floor?.toString() || "");
                                      setFlatModalOpen(true);
                                    }}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-7 h-7 text-red-500 hover:bg-red-50"
                                    onClick={() => setDeletingFlatId(flat.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tower Modal */}
      <Dialog open={towerModalOpen} onOpenChange={setTowerModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingTower ? "Edit Tower" : "Add New Tower"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="t-name">Tower Name</Label>
              <Input
                id="t-name"
                placeholder="E.g., Tower A, Block B"
                value={towerName}
                onChange={(e) => setTowerName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTowerModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTowerSubmit}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flat Modal */}
      <Dialog open={flatModalOpen} onOpenChange={setFlatModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingFlat ? "Edit Flat" : "Add New Flat"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="f-number">Flat Number</Label>
              <Input
                id="f-number"
                placeholder="E.g., 101, 1204"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="f-floor">Floor Number</Label>
              <Input
                id="f-floor"
                type="number"
                placeholder="E.g., 1, 12"
                value={flatFloor}
                onChange={(e) => setFlatFloor(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFlatSubmit}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resident Assignment Modal */}
      <Dialog open={residentModalOpen} onOpenChange={setResidentModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Assign Resident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label htmlFor="r-name">Name</Label>
              <Input
                id="r-name"
                placeholder="Full Name"
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="r-email">Email</Label>
              <Input
                id="r-email"
                type="email"
                placeholder="resident@example.com"
                value={residentEmail}
                onChange={(e) => setResidentEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="r-mobile">Mobile Number (Optional)</Label>
              <Input
                id="r-mobile"
                placeholder="E.g., +91 98765 43210"
                value={residentMobile}
                onChange={(e) => setResidentMobile(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResidentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignResident}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg bg-white border border-gray-200 p-5 rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Bulk Flat Importer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="border border-dashed border-gray-300 rounded-xl p-5 text-center bg-gray-50/50">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">Upload CSV file</p>
              <span className="text-xs text-gray-500">Format: TowerName,FlatNumber,FloorNumber</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-4 text-xs mx-auto block text-gray-500"
              />
            </div>

            {parsedRows.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start space-x-2">
                <FileText className="w-4 h-4 mt-0.5 text-orange-600 shrink-0" />
                <div>
                  <h6 className="text-xs font-bold text-orange-800">Parsed File Summary</h6>
                  <p className="text-[11px] text-orange-700 mt-0.5">
                    Found {parsedRows.length} flat definitions ready for import.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkSubmit}
              disabled={parsedRows.length === 0 || bulkImport.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
              {bulkImport.isPending ? "Importing..." : "Start Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tower Confirmation */}
      <ConfirmDialog
        isOpen={deletingTowerId !== null}
        onOpenChange={(open) => !open && setDeletingTowerId(null)}
        title="Delete Tower?"
        description="This will permanently delete the tower and all flats and residents assigned to it. This action cannot be undone."
        onConfirm={handleDeleteTower}
        confirmLabel="Delete Permanent"
      />

      {/* Delete Flat Confirmation */}
      <ConfirmDialog
        isOpen={deletingFlatId !== null}
        onOpenChange={(open) => !open && setDeletingFlatId(null)}
        title="Delete Flat?"
        description="Are you sure you want to permanently delete this flat? Resident records will lose flat references."
        onConfirm={handleDeleteFlat}
        confirmLabel="Delete Permanent"
      />
    </div>
  );
}

// Loader helper
function Loader2({ className }: { className?: string }) {
  return <Building2 className={`${className} animate-spin`} />;
}
