import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchCustomers } from "@/api/customers"
import { fetchDeliveries, createDelivery, deleteDelivery, type Delivery } from "@/api/deliveries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Undo2, Droplets, Truck } from "lucide-react"
import { format } from "date-fns"

type DeliveryList = { deliveries: Delivery[]; total: number }

// Optimistic rows get negative ids so they can never collide with a real one.
let tempId = 0
const nextTempId = () => --tempId

/** Per-customer jug totals. Undo targets the newest *saved* row - a pending one has no id yet. */
function groupByCustomer(deliveries: Delivery[]) {
  const map = new Map<number, { total: number; lastId: number | null }>()
  for (const d of deliveries) {
    const entry = map.get(d.customer_id) ?? { total: 0, lastId: null }
    entry.total += d.jug_count
    if (d.id > 0 && (entry.lastId === null || d.id > entry.lastId)) entry.lastId = d.id
    map.set(d.customer_id, entry)
  }
  return map
}

if (import.meta.env.DEV) {
  const g = groupByCustomer([
    { id: 5, customer_id: 1, jug_count: 2 },
    { id: 9, customer_id: 1, jug_count: 1 },
    { id: -1, customer_id: 1, jug_count: 3 },
    { id: -2, customer_id: 2, jug_count: 1 },
  ])
  console.assert(g.get(1)!.total === 6, "pending jugs must count toward the total")
  console.assert(g.get(1)!.lastId === 9, "undo must target the newest saved row")
  console.assert(g.get(2)!.lastId === null, "customer with only pending rows has nothing to undo")
}

export default function DeliveryEntryPage() {
  const [search, setSearch] = useState("")
  const [areaFilter, setAreaFilter] = useState("")
  const queryClient = useQueryClient()

  const { data: customerData } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => fetchCustomers({ active: true, limit: 200 }),
  })

  const today = format(new Date(), "yyyy-MM-dd")
  const { data: deliveryData } = useQuery({
    queryKey: ["deliveries", today],
    queryFn: () => fetchDeliveries({ delivery_date: today, limit: 200 }),
    refetchInterval: 10_000,
  })

  const todayKey = ["deliveries", today]

  /** Snapshot + patch the cached list so a tap lands instantly, roll back if the write fails. */
  const optimistic = <V,>(patch: (list: DeliveryList, vars: V) => DeliveryList) => ({
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: todayKey })
      const prev = queryClient.getQueryData<DeliveryList>(todayKey)
      queryClient.setQueryData<DeliveryList>(todayKey, (old) =>
        patch(old ?? { deliveries: [], total: 0 }, vars)
      )
      return { prev }
    },
    onError: (_e: unknown, _v: V, ctx: { prev?: DeliveryList } | undefined) => {
      if (ctx?.prev) queryClient.setQueryData(todayKey, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })

  const deliverMut = useMutation({
    mutationFn: ({ customerId, count }: { customerId: number; count: number }) =>
      createDelivery(customerId, count),
    ...optimistic<{ customerId: number; count: number }>((list, { customerId, count }) => ({
      total: list.total + 1,
      deliveries: [
        {
          id: nextTempId(),
          customer_id: customerId,
          jug_count: count,
          delivered_at: new Date().toISOString(),
          delivery_date: today,
        },
        ...list.deliveries,
      ],
    })),
  })

  const undoMut = useMutation({
    mutationFn: deleteDelivery,
    ...optimistic<number>((list, id) => ({
      total: Math.max(0, list.total - 1),
      deliveries: list.deliveries.filter((d) => d.id !== id),
    })),
  })

  const deliveriesByCustomer = groupByCustomer(deliveryData?.deliveries ?? [])

  const areas = [...new Set((customerData?.customers ?? []).map((c) => c.area).filter(Boolean))]

  const filtered = (customerData?.customers ?? []).filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    if (areaFilter && c.area !== areaFilter) return false
    return true
  })

  const totalJugsToday = [...deliveriesByCustomer.values()].reduce((s, v) => s + v.total, 0)
  const servedToday = deliveriesByCustomer.size

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Daily Delivery</h2>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap">
          <Droplets className="w-4 h-4" />
          {totalJugsToday} jugs
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap">
          <Truck className="w-4 h-4" />
          {servedToday}/{customerData?.total ?? 0} served
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Areas</option>
          {areas.map((a) => (
            <option key={a} value={a!}>{a}</option>
          ))}
        </select>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        {filtered.map((customer) => {
          const info = deliveriesByCustomer.get(customer.id)
          const todayCount = info?.total ?? 0
          const lastId = info?.lastId

          return (
            <Card key={customer.id} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                      {customer.area && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                          {customer.area}
                        </Badge>
                      )}
                    </div>
                    {todayCount > 0 && (
                      <p className="text-xs text-green-600 font-medium">Today: {todayCount} jug{todayCount > 1 ? "s" : ""}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((count) => (
                      <Button
                        key={count}
                        size="sm"
                        variant={count === 1 ? "default" : count === 2 ? "secondary" : "outline"}
                        className="w-10 h-9 text-xs font-bold"
                        onClick={() => deliverMut.mutate({ customerId: customer.id, count })}
                      >
                        +{count}
                      </Button>
                    ))}
                    {lastId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-9 h-9 text-gray-400 hover:text-red-500"
                        onClick={() => undoMut.mutate(lastId)}
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-12">No customers found</p>
        )}
      </div>
    </div>
  )
}
