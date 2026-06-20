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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Camera, User, Phone, Check, RefreshCw, X, Search, ChevronRight } from "lucide-react";

const visitorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number starting with 6-9"),
  purpose: z.string().min(1, "Purpose of visit is required"),
  flatId: z.string().min(1, "Flat is required"),
  vehicleNumber: z.string().regex(/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$|^[A-Z]{2}[0-9]{2}[0-9]{4}$/, "Invalid vehicle number format (e.g. KA01AB1234 or HR26D1234)").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type VisitorFormValues = z.infer<typeof visitorSchema>;

interface Flat {
  id: string;
  number: string;
  tower: {
    name: string;
  };
}

export default function VisitorEntryForm() {
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
    reset,
    formState: { errors },
  } = useForm<VisitorFormValues>({
    resolver: zodResolver(visitorSchema),
    defaultValues: {
      purpose: "Personal",
      flatId: "",
      vehicleNumber: "",
      notes: "",
    },
  });

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
        toast.success("Photo captured!");
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

  const onSubmit = async (data: VisitorFormValues) => {
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("mobile", data.mobile);
      formData.append("purpose", data.purpose);
      formData.append("flatId", data.flatId);
      if (data.vehicleNumber) {
        formData.append("vehicleNumber", data.vehicleNumber.toUpperCase().replace(/\s+/g, ""));
      }
      if (data.notes) {
        formData.append("notes", data.notes);
      }

      if (photoData) {
        const photoFile = dataURLtoFile(photoData, "visitor.jpg");
        formData.append("photo", photoFile);
      }

      const response = await api.post("/visitors/entry", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { _devOtp, entry } = response.data.data;
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-green-700">Visitor logged successfully!</span>
          <span>Approval request sent.</span>
          {_devOtp && (
            <span className="mt-1 font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded text-center">
              DEMO OTP: {_devOtp}
            </span>
          )}
        </div>,
        { duration: 8000 }
      );

      // Reset Form
      reset({
        name: "",
        mobile: "",
        purpose: "Personal",
        flatId: "",
        vehicleNumber: "",
        notes: "",
      });
      setPhotoData(null);
      setSelectedFlat(null);
      setFlatSearch("");
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error?.message || "Failed to create visitor entry";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-neutral-100 max-w-lg mx-auto overflow-hidden border border-neutral-100 pb-12">
      {/* Header */}
      <div className="bg-[#0b0f1a] text-white p-6 relative">
        <h2 className="text-xl font-bold">New Visitor Log</h2>
        <p className="text-neutral-400 text-sm mt-1">Fill out the details to send approval to flat</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <User className="w-4 h-4 text-orange-600" /> Visitor Name
          </Label>
          <Input
            id="name"
            placeholder="Enter full name"
            className={`h-12 rounded-xl bg-neutral-50 border-neutral-200 px-4 text-base focus:ring-2 focus:ring-orange-100 focus:border-[#ef4d23] ${errors.name ? "border-red-500 bg-red-50/20" : ""}`}
            {...register("name")}
            disabled={isSubmitting}
          />
          {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
        </div>

        {/* Mobile Number */}
        <div className="space-y-2">
          <Label htmlFor="mobile" className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-orange-600" /> Mobile Number
          </Label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-neutral-500 font-medium text-base pointer-events-none">+91</span>
            <Input
              id="mobile"
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              className={`h-12 pl-14 rounded-xl bg-neutral-50 border-neutral-200 text-base focus:ring-2 focus:ring-orange-100 focus:border-[#ef4d23] ${errors.mobile ? "border-red-500 bg-red-50/20" : ""}`}
              {...register("mobile")}
              disabled={isSubmitting}
            />
          </div>
          {errors.mobile && <p className="text-xs text-red-500 font-medium">{errors.mobile.message}</p>}
        </div>

        {/* Flat Selection (Combobox) */}
        <div className="space-y-2 relative" ref={dropdownRef}>
          <Label className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-orange-600" /> Select Flat
          </Label>
          <div className="relative">
            <Input
              placeholder={isLoadingFlats ? "Loading flats directory..." : "Search flat number or tower (e.g. Tower A - 101)"}
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
          {showFlatDropdown && flatSearch.length >= 0 && (
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

        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose" className="text-sm font-semibold text-neutral-800">Purpose of Visit</Label>
          <Controller
            name="purpose"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                <SelectTrigger className="h-12 rounded-xl bg-neutral-50 border-neutral-200 px-4 text-base">
                  <SelectValue placeholder="Select purpose" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="Personal">👨‍👩‍👧‍👦 Guest / Personal</SelectItem>
                  <SelectItem value="Delivery">📦 Courier / Delivery</SelectItem>
                  <SelectItem value="Maid">🧹 Staff / Maid</SelectItem>
                  <SelectItem value="Interview">💼 Interview / Business</SelectItem>
                  <SelectItem value="Other">❓ Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.purpose && <p className="text-xs text-red-500 font-medium">{errors.purpose.message}</p>}
        </div>

        {/* Vehicle Number */}
        <div className="space-y-2">
          <Label htmlFor="vehicleNumber" className="text-sm font-semibold text-neutral-800">Vehicle Number (Optional)</Label>
          <Input
            id="vehicleNumber"
            placeholder="e.g. KA01AB1234"
            className={`h-12 rounded-xl bg-neutral-50 border-neutral-200 px-4 text-base focus:ring-2 focus:ring-orange-100 focus:border-[#ef4d23] ${errors.vehicleNumber ? "border-red-500 bg-red-50/20" : ""}`}
            {...register("vehicleNumber")}
            disabled={isSubmitting}
            onChange={(e) => setValue("vehicleNumber", e.target.value.toUpperCase())}
          />
          {errors.vehicleNumber && <p className="text-xs text-red-500 font-medium">{errors.vehicleNumber.message}</p>}
        </div>

        {/* Photo Capture Section */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-neutral-800 flex items-center justify-between">
            <span>Visitor Photo</span>
            <span className="text-xs text-neutral-400 font-normal">Optional</span>
          </Label>

          {showCamera ? (
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-inner bg-black flex flex-col items-center">
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
                  Flip Camera
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
                alt="Captured visitor"
                className="w-20 h-20 rounded-xl object-cover border border-neutral-200 shadow-sm"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-700">Photo Captured</p>
                <p className="text-xs text-neutral-400">Ready to submit</p>
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
              className="w-full h-32 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:bg-orange-50/20 hover:border-orange-200 transition-all flex flex-col items-center justify-center gap-2 text-neutral-500 hover:text-[#ef4d23]"
              disabled={isSubmitting}
            >
              <Camera className="w-8 h-8 opacity-70" />
              <span className="font-semibold text-sm">Tap to Open Camera</span>
              <span className="text-[11px] opacity-75">Click snapshot to save visitor face</span>
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-semibold text-neutral-800">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="e.g. Courier boy is carrying multiple boxes, visitor needs wheelchair..."
            className="rounded-xl border-neutral-200 focus:ring-2 focus:ring-orange-100 focus:border-[#ef4d23]"
            {...register("notes")}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-orange-500/25 transition-transform active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Submitting entry...
            </>
          ) : (
            <>
              <span>Log Entry & Request Approval</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
