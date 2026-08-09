import { NavLink, Outlet } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { LayoutDashboard, Truck, BookOpen, Users, FileText, Settings, LogOut } from "lucide-react"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/deliveries", icon: Truck, label: "Deliveries" },
  { to: "/register", icon: BookOpen, label: "Register" },
  { to: "/customers", icon: Users, label: "Customers" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

export default function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar - desktop */}
      <header className="hidden md:flex print:!hidden bg-white border-b border-gray-200 px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-bold text-blue-700 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            JalTrack
          </h1>
          <nav className="flex gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden print:!hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-50">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              // 6 tabs, so labels shrink to stay on one line at 360px.
              `flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] leading-tight transition-colors ${
                isActive ? "text-blue-600" : "text-gray-500"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
