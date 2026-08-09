import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchCustomers } from "@/api/customers"
import { fetchDeliveries, createDelivery, deleteDelivery, type Delivery } from "@/api/deliveries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Undo2, Droplets, Truck, Rows3, LayoutGrid } from "lucide-react"
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

type View = "cards" | "register"

/** The +1/+2/+3 and undo cluster, shared by both layouts. */
function JugButtons({
  lastId,
  onDeliver,
  onUndo,
}: {
  lastId: number | null
  onDeliver: (count: number) => void
  onUndo: (id: number) => void
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {[1, 2, 3].map((count) => (
        <Button
          key={count}
          size="sm"
          variant={count === 1 ? "default" : count === 2 ? "secondary" : "outline"}
          className="w-10 h-9 text-xs font-bold"
          onClick={() => onDeliver(count)}
        >
          +{count}
        </Button>
      ))}
      {/* Kept in the layout when absent so register columns stay aligned. */}
      <Button
        size="sm"
        variant="ghost"
        title="Undo last entry"
        disabled={!lastId}
        onClick={() => lastId && onUndo(lastId)}
        className={`w-9 h-9 ${lastId ? "text-gray-400 hover:text-red-500" : "invisible"}`}
      >
        <Undo2 className="w-4 h-4" />
      </Button>
    </div>
  )
}

export default function DeliveryEntryPage() {
  const [search, setSearch] = useState("")
  const [areaFilter, setAreaFilter] = useState("")
  const [view, setView] = useState<View>(
    () => (localStorage.getItem("delivery_view") as View) || "register"
  )
  const queryClient = useQueryClient()

  useEffect(() => localStorage.setItem("delivery_view", view), [view])

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
      <div className="flex items-center gap-3">
        <div className="flex gap-3 overflow-x-auto pb-1 flex-1">
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap">
            <Droplets className="w-4 h-4" />
            {totalJugsToday} jugs
          </div>
          <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap">
            <Truck className="w-4 h-4" />
            {servedToday}/{customerData?.total ?? 0} served
          </div>
        </div>

        <div className="flex rounded-md border border-gray-300 overflow-hidden flex-shrink-0">
          {([
            { key: "register", icon: Rows3, label: "Register" },
            { key: "cards", icon: LayoutGrid, label: "Cards" },
          ] as const).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              title={`${v.label} view`}
              className={`flex items-center gap-1.5 px-2.5 h-9 text-xs font-medium transition-colors cursor-pointer ${
                view === v.key ? "bg-blue-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <v.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
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

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">No customers found</p>
      ) : view === "register" ? (
        /* Register - a ruled ledger, like the paper book */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 border-b-2 border-gray-300">
                  <th className="w-14 px-2 py-2 text-center font-semibold border-r border-gray-200">Sr.</th>
                  <th className="px-3 py-2 text-left font-semibold border-r border-gray-200">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold border-r border-gray-200 hidden sm:table-cell">Area</th>
                  <th className="w-20 px-2 py-2 text-center font-semibold border-r border-gray-200">Jugs</th>
                  <th className="px-3 py-2 text-right font-semibold">Entry</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer, i) => {
                  const info = deliveriesByCustomer.get(customer.id)
                  const todayCount = info?.total ?? 0
                  const lastId = info?.lastId ?? null

                  return (
                    <tr
                      key={customer.id}
                      className={`border-b border-gray-200 ${i % 2 ? "bg-gray-50/60" : "bg-white"} hover:bg-blue-50/50`}
                    >
                      <td className="px-2 py-1.5 text-center text-gray-400 tabular-nums border-r border-gray-100">
                        {i + 1}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-gray-900 border-r border-gray-100">
                        {customer.name}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500 border-r border-gray-100 hidden sm:table-cell">
                        {customer.area || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center border-r border-gray-100 tabular-nums">
                        {todayCount > 0 ? (
                          <span className="font-bold text-green-700">{todayCount}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <JugButtons
                          lastId={lastId}
                          onDeliver={(count) => deliverMut.mutate({ customerId: customer.id, count })}
                          onUndo={(id) => undoMut.mutate(id)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="px-2 py-2 text-center text-gray-400">—</td>
                  <td className="px-3 py-2" colSpan={2}>TOTAL</td>
                  <td className="px-2 py-2 text-center tabular-nums text-green-700">{totalJugsToday}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      ) : (
        /* Cards - roomier tap targets for phone use */
        <div className="space-y-2">
          {filtered.map((customer, i) => {
            const info = deliveriesByCustomer.get(customer.id)
            const todayCount = info?.total ?? 0
            const lastId = info?.lastId ?? null

            return (
              <Card key={customer.id} className="overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 tabular-nums w-6 flex-shrink-0">{i + 1}.</span>
                        <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
                        {customer.area && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                            {customer.area}
                          </Badge>
                        )}
                      </div>
                      {todayCount > 0 && (
                        <p className="text-xs text-green-600 font-medium pl-6">
                          Today: {todayCount} jug{todayCount > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    <JugButtons
                      lastId={lastId}
                      onDeliver={(count) => deliverMut.mutate({ customerId: customer.id, count })}
                      onUndo={(id) => undoMut.mutate(id)}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
