"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Webcam from "react-webcam";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Package, Search, ChevronRight, User, Phone, Camera, X, RefreshCw, Check, Minus, Plus } from "lucide-react";

const deliverySchema = z.object({
  flatId: z.string().min(1, "Flat is required"),
  category: z.string().min(1, "Category is required"),
  deliveryPersonName: z.string().min(2, "Agent name must be at least 2 characters").optional().or(z.literal("")),
  deliveryPersonMobile: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit mobile number").optional().or(z.literal("")),
  packageCount: z.number().min(1, "Must be at least 1 package"),
  notes: z.string().optional(),
});


type DeliveryFormValues = z.infer<typeof deliverySchema>;

interface Flat {
  id: string;
  number: string;
  tower: {
    name: string;
  };
}

const CATEGORIES = [
  { id: "Amazon", label: "Amazon", icon: "📦" },
  { id: "Flipkart", label: "Flipkart", icon: "📦" },
  { id: "Swiggy", label: "Swiggy", icon: "🍔" },
  { id: "Zomato", label: "Zomato", icon: "🍕" },
  { id: "Courier", label: "Courier", icon: "📨" },
  { id: "Other", label: "Other", icon: "📋" },
];

export default function DeliveryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flatSearch, setFlatSearch] = useState("");
  const [selectedFlat, setSelectedFlat] = useState<Flat | null>(null);
  const [showFlatDropdown, setShowFlatDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<Webcam>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      flatId: "",
      category: "Amazon",
      packageCount: 1,
      deliveryPersonName: "",
      deliveryPersonMobile: "",
      notes: "",
    },
  });

  const selectedCategory = watch("category");
  const packageCount = watch("packageCount");

  // Fetch all flats in the guard's society
  const { data: flats = [], isLoading: isLoadingFlats } = useQuery<Flat[]>({
    queryKey: ["society-flats"],
    queryFn: async () => {
      const res = await api.get("/visitors/flats");
      return res.data.data;
    },
  });

  // Filter flats based on search input
  const filteredFlats = flats.filter((flat) => {
    const searchStr = `${flat.tower.name} - ${flat.number}`.toLowerCase();
    return searchStr.includes(flatSearch.toLowerCase());
  });

  // Handle outside click to close flats search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFlatDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const capturePhoto = () => {
    if (webcamRef.current) {
      const screenshot = webcamRef.current.getScreenshot();
      if (screenshot) {
        setPhotoData(screenshot);
        setShowCamera(false);
        toast.success("Delivery photo captured!");
      }
    }
  };

  // Helper to convert base64 to File
  const dataURLtoFile = (dataUrl: string, filename: string) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const onSubmit = async (data: DeliveryFormValues) => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("flatId", data.flatId);
      formData.append("category", data.category);
      formData.append("packageCount", data.packageCount.toString());
      if (data.deliveryPersonName) {
        formData.append("deliveryPersonName", data.deliveryPersonName);
      }
      if (data.deliveryPersonMobile) {
        formData.append("deliveryPersonMobile", data.deliveryPersonMobile);
      }
      if (data.notes) {
        formData.append("notes", data.notes);
      }

      if (photoData) {
        const photoFile = dataURLtoFile(photoData, "delivery.jpg");
        formData.append("photo", photoFile);
      }

      await api.post("/deliveries/log", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(`Delivery logged successfully! Resident has been notified.`);

      // Reset Form
      reset({
        flatId: "",
        category: "Amazon",
        packageCount: 1,
        deliveryPersonName: "",
        deliveryPersonMobile: "",
        notes: "",
      });
      setPhotoData(null);
      setSelectedFlat(null);
      setFlatSearch("");
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || "Failed to log delivery";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-neutral-100 max-w-lg mx-auto overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6 relative">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-orange-500" /> Log Delivery Package
        </h2>
        <p className="text-neutral-400 text-sm mt-1">Record incoming parcels at the gate</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Flat Selection (Combobox) */}
        <div className="space-y-2 relative" ref={dropdownRef}>
          <Label className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-orange-600" /> Select Flat / Resident
          </Label>
          <div className="relative">
            <Input
              placeholder={isLoadingFlats ? "Loading flats directory..." : "Search flat (e.g. Tower A - 102)"}
              className={`h-12 rounded-xl bg-neutral-50 border-neutral-200 px-4 text-base focus:ring-2 focus:ring-orange-100 focus:border-[#ef4d23]`}
              value={flatSearch}
              onChange={(e) => {
                setFlatSearch(e.target.value);
                setShowFlatDropdown(true);
              }}
              onFocus={() => setShowFlatDropdown(true)}
              disabled={isSubmitting || isLoadingFlats}
            />
            {selectedFlat && (
              <span className="absolute right-3 top-3 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1.5 rounded-lg font-bold border border-emerald-100 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Selected
              </span>
            )}
          </div>
          {showFlatDropdown && (
            <div className="absolute z-50 w-full left-0 mt-1 bg-white border border-neutral-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-neutral-100">
              {filteredFlats.length > 0 ? (
                filteredFlats.map((flat) => (
                  <button
                    key={flat.id}
                    type="button"
                    className="w-full text-left px-5 py-3.5 text-base hover:bg-orange-50/40 hover:text-[#ef4d23] font-medium transition-colors flex items-center justify-between"
                    onClick={() => {
                      setSelectedFlat(flat);
                      setValue("flatId", flat.id);
                      setFlatSearch(`${flat.tower.name} - ${flat.number}`);
                      setShowFlatDropdown(false);
                    }}
                  >
                    <span>{flat.tower.name} - Flat {flat.number}</span>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                ))
              ) : (
                <div className="p-4 text-sm text-neutral-400 text-center">No matching flats found</div>
              )}
            </div>
          )}
          {errors.flatId && <p className="text-xs text-red-500 font-medium">{errors.flatId.message}</p>}
        </div>

        {/* Category Grid */}
        <div className="space-y-2.5">
          <Label className="text-sm font-semibold text-neutral-800">Delivery Provider</Label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setValue("category", cat.id)}
                  disabled={isSubmitting}
                  className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                    isSelected
                      ? "border-orange-600 bg-orange-50/60 text-orange-700 shadow-md shadow-orange-500/5 font-extrabold scale-105"
                      : "border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-600"
                  }`}
                  style={{ minHeight: "85px" }}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-xs font-bold leading-none">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Package Count Stepper */}
        <div className="space-y-2.5 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 flex items-center justify-between">
          <div>
            <Label className="text-sm font-bold text-neutral-800">Number of Packages</Label>
            <p className="text-neutral-500 text-xs mt-0.5">Stepping quantity of parcels</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setValue("packageCount", Math.max(1, packageCount - 1))}
              disabled={isSubmitting || packageCount <= 1}
              className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 active:scale-95 disabled:opacity-40 transition-transform"
            >
              <Minus className="w-5 h-5 text-neutral-600" />
            </button>
            <span className="text-lg font-black text-neutral-800 w-6 text-center">{packageCount}</span>
            <button
              type="button"
              onClick={() => setValue("packageCount", packageCount + 1)}
              disabled={isSubmitting}
              className="w-10 h-10 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Delivery Agent Name */}
        <div className="space-y-2">
          <Label htmlFor="deliveryPersonName" className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-orange-600" /> Delivery Agent Name (Optional)
          </Label>
          <Input
            id="deliveryPersonName"
            placeholder="e.g. Rahul Kumar"
            className="h-12 rounded-xl bg-neutral-50 border-neutral-200 px-4 text-base focus:ring-2 focus:ring-orange-100"
            {...register("deliveryPersonName")}
            disabled={isSubmitting}
          />
          {errors.deliveryPersonName && <p className="text-xs text-red-500">{errors.deliveryPersonName.message}</p>}
        </div>

        {/* Delivery Agent Mobile */}
        <div className="space-y-2">
          <Label htmlFor="deliveryPersonMobile" className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-orange-600" /> Agent Mobile (Optional)
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-neutral-500 font-medium text-base pointer-events-none">+91</span>
            <Input
              id="deliveryPersonMobile"
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              className="h-12 pl-14 rounded-xl bg-neutral-50 border-neutral-200 text-base focus:ring-2 focus:ring-orange-100"
              {...register("deliveryPersonMobile")}
              disabled={isSubmitting}
            />
          </div>
          {errors.deliveryPersonMobile && <p className="text-xs text-red-500">{errors.deliveryPersonMobile.message}</p>}
        </div>

        {/* Webcam Capture for Package Label / Parcel */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-neutral-800 flex items-center justify-between">
            <span>Parcel/Slip Photo (Optional)</span>
            <span className="text-xs text-neutral-400 font-normal">Optional</span>
          </Label>

          {showCamera ? (
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-black flex flex-col items-center">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode }}
                className="w-full aspect-video object-cover"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4 z-10">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="bg-orange-600 hover:bg-orange-700 text-white rounded-full px-5 py-2.5 text-sm font-bold shadow-lg"
                >
                  Snap Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFacingMode(facingMode === "user" ? "environment" : "user")}
                  className="bg-white/80 backdrop-blur border-0 hover:bg-white text-neutral-800 rounded-full px-4"
                >
                  Flip
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCamera(false)}
                  className="bg-black/40 text-white hover:bg-black/60 rounded-full w-10 h-10 p-0 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : photoData ? (
            <div className="relative border-2 border-dashed border-neutral-200 rounded-2xl p-4 bg-neutral-50 flex items-center gap-4">
              <img
                src={photoData}
                alt="Captured package"
                className="w-20 h-20 rounded-xl object-cover border border-neutral-200 shadow-sm"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-700">Photo Attached</p>
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="text-orange-600 hover:text-orange-700 text-xs font-bold mt-1.5 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retake Photo
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPhotoData(null)}
                className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="w-full h-24 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-orange-50/20 hover:border-orange-200 transition-all flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-[#ef4d23]"
              disabled={isSubmitting}
            >
              <Camera className="w-6 h-6 opacity-70" />
              <span className="font-semibold text-xs">Capture Parcel/Agent Photo</span>
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-semibold text-neutral-800 font-medium">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Add any specific details (e.g. kept at Gate A, left with security...)"
            className="rounded-xl border-neutral-200 focus:ring-2 focus:ring-orange-100"
            {...register("notes")}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-orange-500/25 transition-transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Logging package...
            </>
          ) : (
            <>
              <span>Confirm Package Delivery</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
