"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Briefcase, Calendar, Check, LogOut } from "lucide-react";

interface StaffCardProps {
  staff: {
    id: string;
    name: string;
    type: string;
    mobile?: string;
    photoUrl?: string;
    isActive: boolean;
    notesForGuard?: string;
    attendanceToday?: {
      id: string;
      checkInTime?: string;
      checkOutTime?: string;
      status: string;
    } | null;
  };
  onCheckIn?: (staffId: string) => void;
  onCheckOut?: (attendanceId: string) => void;
  isLoading?: boolean;
}

export default function StaffCard({ staff, onCheckIn, onCheckOut, isLoading }: StaffCardProps) {
  const { name, type, mobile, photoUrl, isActive, notesForGuard, attendanceToday } = staff;

  const isInside = attendanceToday && attendanceToday.checkInTime && !attendanceToday.checkOutTime;
  const hasLeft = attendanceToday && attendanceToday.checkOutTime;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow border border-gray-200 bg-white">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start space-x-4">
          <Avatar className="w-12 h-12 border border-gray-100 flex-shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl.startsWith("http") ? photoUrl : `http://localhost:3000${photoUrl}`}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-orange-50 text-orange-600 font-semibold text-lg">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1 gap-2">
              <h4 className="font-bold text-gray-900 truncate text-base">{name}</h4>
              <div className="flex space-x-1 items-center">
                {!isActive && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-[10px]">
                    Inactive
                  </Badge>
                )}
                {isInside ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] border-green-200">
                    Inside
                  </Badge>
                ) : hasLeft ? (
                  <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-[10px] border-gray-200">
                    Left
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-[10px] border-yellow-200">
                    Outside
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Briefcase className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-orange-600 capitalize text-xs bg-orange-50 px-2 py-0.5 rounded-full">
                  {type}
                </span>
              </div>
              {mobile && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>{mobile}</span>
                </div>
              )}
              {notesForGuard && (
                <p className="text-xs italic text-gray-500 bg-gray-50 p-2 rounded mt-1 border-l-2 border-orange-400">
                  Notes: "{notesForGuard}"
                </p>
              )}
            </div>

            {/* In/Out Actions for Guard Roster */}
            {isActive && (onCheckIn || onCheckOut) && (
              <div className="mt-3">
                {isInside && onCheckOut ? (
                  <Button
                    size="sm"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                    onClick={() => onCheckOut(attendanceToday.id)}
                    disabled={isLoading}
                  >
                    <LogOut className="w-4 h-4 mr-1.5" /> Log Check-Out
                  </Button>
                ) : !isInside && onCheckIn ? (
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                    onClick={() => onCheckIn(staff.id)}
                    disabled={isLoading}
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Log Check-In
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
