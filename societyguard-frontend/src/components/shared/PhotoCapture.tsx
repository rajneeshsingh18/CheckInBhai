"use client";

import { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

interface PhotoCaptureProps {
  onCapture: (imageSrc: string) => void;
  className?: string;
}

export default function PhotoCapture({ onCapture, className }: PhotoCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImg, setCapturedImg] = useState<string | null>(null);

  const capture = useCallback(() => {
    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        toast.error("Could not capture screenshot from camera");
        return;
      }
      setCapturedImg(imageSrc);
    } catch (e) {
      toast.error("Failed to capture photo");
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImg(null);
  };

  const confirmPhoto = () => {
    if (capturedImg) {
      onCapture(capturedImg);
    }
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  return (
    <div className={`flex flex-col items-center bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 ${className}`}>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3.5">
        Visitor Photo Capture
      </span>

      <div className="relative w-full max-w-sm aspect-[4/3] rounded-xl overflow-hidden bg-black border border-gray-300 shadow-inner flex items-center justify-center">
        {capturedImg ? (
          <img src={capturedImg} alt="Captured preview" className="w-full h-full object-cover" />
        ) : (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex space-x-2.5 mt-5 w-full max-w-sm">
        {capturedImg ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={retake}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" /> Retake
            </Button>
            <Button
              size="sm"
              onClick={confirmPhoto}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm"
            >
              <Check className="w-4 h-4 mr-1.5" /> Use Photo
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={capture}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"
          >
            <Camera className="w-4 h-4 mr-1.5" /> Capture Photo
          </Button>
        )}
      </div>
    </div>
  );
}
