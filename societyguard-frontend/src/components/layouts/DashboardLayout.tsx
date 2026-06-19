"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { 
  Bell, Menu, ChevronDown, User, LogOut, Settings, 
  Home, QrCode, PlusCircle, List, UserSquare, Package, 
  AlertTriangle, Shield, Users, BarChart3, Building
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRole } from "@/types/auth";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  isCenter?: boolean;
}

const getNavItems = (role?: UserRole): NavItem[] => {
  switch (role) {
    case "GUARD":
      return [
        { name: "Home", href: "/guard", icon: <Home className="w-6 h-6" /> },
        { name: "Activity", href: "/guard/activity", icon: <List className="w-6 h-6" /> },
        { name: "Scanner", href: "/guard/scanner", icon: <QrCode className="w-8 h-8" />, isCenter: true },
        { name: "Entry", href: "/guard/entry", icon: <PlusCircle className="w-6 h-6" /> },
        { name: "More", href: "/guard/more", icon: <Menu className="w-6 h-6" /> },
      ];
    case "RESIDENT":
      return [
        { name: "Home", href: "/resident", icon: <Home className="w-5 h-5" /> },
        { name: "Visitors", href: "/resident/visitors", icon: <UserSquare className="w-5 h-5" /> },
        { name: "Passes", href: "/resident/passes", icon: <QrCode className="w-5 h-5" /> },
        { name: "Deliveries", href: "/resident/deliveries", icon: <Package className="w-5 h-5" /> },
        { name: "Staff", href: "/resident/staff", icon: <Users className="w-5 h-5" /> },
      ];
    case "SOCIETY_ADMIN":
      return [
        { name: "Dashboard", href: "/admin", icon: <Home className="w-5 h-5" /> },
        { name: "Visitors", href: "/admin/visitors", icon: <List className="w-5 h-5" /> },
        { name: "Guards", href: "/admin/guards", icon: <Shield className="w-5 h-5" /> },
        { name: "Staff", href: "/admin/staff", icon: <Users className="w-5 h-5" /> },
        { name: "Reports", href: "/admin/reports", icon: <BarChart3 className="w-5 h-5" /> },
      ];
    case "SUPER_ADMIN":
      return [
        { name: "Dashboard", href: "/super-admin", icon: <Home className="w-5 h-5" /> },
        { name: "Societies", href: "/super-admin/societies", icon: <Building className="w-5 h-5" /> },
        { name: "Analytics", href: "/super-admin/analytics", icon: <BarChart3 className="w-5 h-5" /> },
      ];
    default:
      return [];
  }
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems = getNavItems(user?.role);
  const isGuard = user?.role === "GUARD";

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar (hidden for guards as they use mobile mostly, but kept for responsiveness) */}
      {!isGuard && (
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0 z-30">
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <Shield className="w-6 h-6 text-orange-600 mr-2" />
            <span className="font-bold text-lg text-gray-900">Rakshak</span>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4">
            <nav className="space-y-1 px-3">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-orange-50 text-orange-600"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className={`mr-3 flex-shrink-0 ${isActive ? "text-orange-600" : "text-gray-400"}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-gray-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center w-full focus:outline-none">
                  <Avatar className="w-9 h-9 border border-gray-200">
                    <AvatarFallback className="bg-orange-100 text-orange-700">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="ml-3 flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.role.replace('_', ' ')}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isGuard ? 'pb-24' : 'md:pb-0 pb-20'}`}>
        {/* Header */}
        <header className={`bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 ${isGuard ? '' : 'md:hidden'}`}>
          <div className="flex items-center">
            {isGuard ? (
              <div className="flex items-center">
                <Avatar className="w-10 h-10 border border-gray-200 mr-3">
                  <AvatarFallback className="bg-orange-100 text-orange-700">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Hi, {user.name.split(' ')[0]}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                    On Duty
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <Shield className="w-6 h-6 text-orange-600 mr-2" />
                <span className="font-bold text-lg text-gray-900">Rakshak</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 block w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            
            {isGuard ? (
              <div className="flex items-center space-x-1">
                <button className="p-2 text-red-500 hover:text-red-600 focus:outline-none bg-red-50 rounded-full mr-1">
                  <AlertTriangle className="w-5 h-5" />
                </button>
                <button onClick={logout} className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none">
                    <Avatar className="w-8 h-8 border border-gray-200">
                      <AvatarFallback className="bg-orange-100 text-orange-700">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Guard Specific Sub-header */}
        {isGuard && user.societyId && (
          <div className="bg-orange-50/50 px-4 py-2.5 border-b border-orange-100 flex items-center space-x-2">
            <Building className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-800">Society ID: {user.societyId}</span>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 sm:px-4 z-30 ${isGuard ? 'pb-safe' : 'md:hidden pb-safe'}`}>
        <div className="flex justify-around items-end h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
            
            if (item.isCenter) {
              return (
                <Link key={item.name} href={item.href} className="flex flex-col items-center justify-center w-16 relative -top-5">
                  <div className="w-14 h-14 rounded-full bg-orange-600 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white mb-1">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-medium text-gray-600">{item.name}</span>
                </Link>
              );
            }
            
            return (
              <Link key={item.name} href={item.href} className={`flex flex-col items-center justify-center w-16 h-full space-y-1 ${isActive ? "text-orange-600" : "text-gray-500"}`}>
                <div className={isActive ? "text-orange-600 fill-current" : ""}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      
      {/* Global SOS FAB for Resident/Admin - based on Design.md */}
      {!isGuard && (
        <button className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 w-14 h-14 rounded-full bg-red-600 shadow-lg shadow-red-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
          <AlertTriangle className="w-6 h-6 text-white" />
        </button>
      )}
    </div>
  );
}
