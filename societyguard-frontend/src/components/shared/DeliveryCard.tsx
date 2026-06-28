"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/shared/StatusBadge";
import { Package, User, Phone, MapPin, Clock, Check, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface DeliveryCardProps {
  delivery: {
    id: string;
    category: string;
    deliveryPersonName?: string;
    deliveryPersonMobile?: string;
    packageCount: number;
    status: string;
    receivedAt: string;
    pickedUpAt?: string | null;
    notes?: string | null;
    flat: {
      number: string;
      tower?: {
        name: string;
      };
    };
  };
  onPickup?: (id: string) => void;
  onReturn?: (id: string) => void;
  isLoading?: boolean;
}

export default function DeliveryCard({ delivery, onPickup, onReturn, isLoading }: DeliveryCardProps) {
  const { category, deliveryPersonName, deliveryPersonMobile, packageCount, status, receivedAt, pickedUpAt, notes, flat } = delivery;
  const towerName = flat.tower?.name ? `${flat.tower.name} - ` : "";
  const flatLocation = `${towerName}Flat ${flat.number}`;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow border border-gray-200 bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <Package className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <h4 className="font-bold text-gray-900 truncate text-base">
                {category} <span className="text-gray-400 font-normal">({packageCount} pkg)</span>
              </h4>
              <StatusBadge status={status} />
            </div>

            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-800">{flatLocation}</span>
              </div>
              {deliveryPersonName && (
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>Courier: <span className="font-medium text-gray-800">{deliveryPersonName}</span></span>
                </div>
              )}
              {deliveryPersonMobile && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>{deliveryPersonMobile}</span>
                </div>
              )}
              {notes && (
                <p className="text-xs italic text-gray-500 bg-gray-50 p-2 rounded mt-1 border-l-2 border-indigo-400">
                  "{notes}"
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500 gap-2">
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                <span>Received: {format(new Date(receivedAt), "MMM d, h:mm a")}</span>
              </div>
              {pickedUpAt && (
                <div className="flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  <span>Collected: {format(new Date(pickedUpAt), "h:mm a")}</span>
                </div>
              )}
            </div>

            {status === "RECEIVED" && (onPickup || onReturn) && (
              <div className="flex space-x-2 mt-4">
                {onPickup && (
                  <Button
                    size="sm"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors"
                    onClick={() => onPickup(delivery.id)}
                    disabled={isLoading}
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Mark Collected
                  </Button>
                )}
                {onReturn && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 font-medium transition-colors"
                    onClick={() => onReturn(delivery.id)}
                    disabled={isLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Return to Courier
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
