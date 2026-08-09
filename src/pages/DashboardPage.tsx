import { useQuery } from "@tanstack/react-query"
import { fetchDashboard } from "@/api/deliveries"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Truck, Droplets, Clock } from "lucide-react"
import { format } from "date-fns"

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading dashboard...</div>
  }

  const stats = [
    {
      label: "Total Customers",
      value: data?.total_customers ?? 0,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Served Today",
      value: data?.customers_served_today ?? 0,
      icon: Truck,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Jugs Today",
      value: data?.total_jugs_today ?? 0,
      icon: Droplets,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Pending",
      value: (data?.total_customers ?? 0) - (data?.customers_served_today ?? 0),
      icon: Clock,
      color: "bg-orange-50 text-orange-600",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Deliveries</h3>
          {!data?.recent_entries?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No deliveries recorded today</p>
          ) : (
            <div className="space-y-2">
              {data.recent_entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {entry.customer_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {entry.delivered_at
                        ? format(new Date(entry.delivered_at), "h:mm a")
                        : ""}
                    </p>
                  </div>
                  <Badge variant="default">+{entry.jug_count} jug{entry.jug_count > 1 ? "s" : ""}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
