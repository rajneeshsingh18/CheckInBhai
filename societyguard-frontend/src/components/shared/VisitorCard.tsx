"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import { User, Phone, MapPin, Calendar, Clock, LogOut, Check, X } from "lucide-react";
import { format } from "date-fns";

interface VisitorCardProps {
  entry: {
    id: string;
    purpose?: string;
    status: string;
    entryTime?: string;
    exitTime?: string;
    createdAt: string;
    notes?: string;
    visitor: {
      name: string;
      mobile: string;
      photoUrl?: string;
    };
    flat: {
      number: string;
      tower?: {
        name: string;
      };
    };
  };
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onExit?: (id: string) => void;
  isLoading?: boolean;
}

export default function VisitorCard({ entry, onApprove, onReject, onExit, isLoading }: VisitorCardProps) {
  const { visitor, flat, purpose, status, entryTime, exitTime, notes } = entry;
  const towerName = flat.tower?.name ? `${flat.tower.name} - ` : "";
  const flatLocation = `${towerName}Flat ${flat.number}`;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow border border-gray-200 bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start space-x-4">
          <Avatar className="w-12 h-12 border border-gray-100 flex-shrink-0">
            {visitor.photoUrl ? (
              <img
                src={visitor.photoUrl.startsWith("http") ? visitor.photoUrl : `http://localhost:3000${visitor.photoUrl}`}
                alt={visitor.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-orange-50 text-orange-600 font-semibold text-lg">
                {visitor.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <h4 className="font-bold text-gray-900 truncate text-base">{visitor.name}</h4>
              <StatusBadge status={status} />
            </div>

            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>{visitor.mobile}</span>
              </div>
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-800">{flatLocation}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span>Purpose: <span className="font-medium text-gray-800 capitalize">{purpose || "Personal"}</span></span>
              </div>
              {notes && (
                <p className="text-xs italic bg-gray-50 p-2 rounded text-gray-500 mt-1 border-l-2 border-orange-400">
                  "{notes}"
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500 gap-2">
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" />
                <span>
                  Logged: {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
              {entryTime && (
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1 text-green-500" />
                  <span>Entry: {format(new Date(entryTime), "h:mm a")}</span>
                </div>
              )}
              {exitTime && (
                <div className="flex items-center">
                  <LogOut className="w-3.5 h-3.5 mr-1 text-red-500" />
                  <span>Exit: {format(new Date(exitTime), "h:mm a")}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {status === "PENDING" && (onApprove || onReject) && (
              <div className="flex space-x-2 mt-4">
                {onApprove && (
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm transition-colors"
                    onClick={() => onApprove(entry.id)}
                    disabled={isLoading}
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Approve
                  </Button>
                )}
                {onReject && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-medium transition-colors"
                    onClick={() => onReject(entry.id)}
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4 mr-1.5" /> Reject
                  </Button>
                )}
              </div>
            )}

            {status === "APPROVED" && onExit && (
              <div className="mt-4">
                <Button
                  size="sm"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors"
                  onClick={() => onExit(entry.id)}
                  disabled={isLoading}
                >
                  <LogOut className="w-4 h-4 mr-1.5" /> Log Exit
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
