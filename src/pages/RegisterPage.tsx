import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchCustomers } from "@/api/customers"
import { fetchDeliveries } from "@/api/deliveries"
import { downloadCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { FileSpreadsheet, FileText, Search, AlertCircle } from "lucide-react"
import { format, getDaysInMonth } from "date-fns"

interface RegisterRow {
  id: number
  name: string
  area?: string | null
  byDay: Map<number, number>
  total: number
}

export default function RegisterPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"))
  const [search, setSearch] = useState("")
  const [hideEmpty, setHideEmpty] = useState(false)

  const firstOfMonth = `${month}-01`
  const daysInMonth = getDaysInMonth(new Date(`${firstOfMonth}T00:00:00`))
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const lastOfMonth = `${month}-${String(daysInMonth).padStart(2, "0")}`
  const todayKey = format(new Date(), "yyyy-MM-dd")

  const { data: customerData } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => fetchCustomers({ active: true, limit: 500 }),
  })

  const { data: deliveryData, isLoading } = useQuery({
    queryKey: ["register", month],
    queryFn: () => fetchDeliveries({ from: firstOfMonth, to: lastOfMonth, limit: 20000 }),
  })

  // The server reports the true count; if it exceeds what came back, the grid is incomplete.
  const truncated =
    deliveryData != null && deliveryData.total > deliveryData.deliveries.length

  const rows: RegisterRow[] = useMemo(() => {
    const byCustomer = new Map<number, RegisterRow>()
    for (const c of customerData?.customers ?? []) {
      byCustomer.set(c.id, { id: c.id, name: c.name, area: c.area, byDay: new Map(), total: 0 })
    }
    for (const d of deliveryData?.deliveries ?? []) {
      const row = byCustomer.get(d.customer_id)
      if (!row || !d.delivery_date) continue
      const day = Number(d.delivery_date.slice(8, 10))
      // Several entries on one day collapse into a single cell, like one line in the book.
      row.byDay.set(day, (row.byDay.get(day) ?? 0) + d.jug_count)
      row.total += d.jug_count
    }
    return [...byCustomer.values()]
  }, [customerData, deliveryData])

  const visible = rows.filter((r) => {
    if (hideEmpty && r.total === 0) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const dayTotals = days.map((d) => visible.reduce((s, r) => s + (r.byDay.get(d) ?? 0), 0))
  const grandTotal = visible.reduce((s, r) => s + r.total, 0)

  const exportCsv = () =>
    downloadCsv(`jaltrack-register-${month}.csv`, [
      ["Sr.", "Customer", "Area", ...days.map(String), "Total"],
      ...visible.map((r, i) => [
        i + 1,
        r.name,
        r.area ?? "",
        ...days.map((d) => r.byDay.get(d) ?? ""),
        r.total,
      ]),
      ["", "TOTAL", "", ...dayTotals.map((t) => t || ""), grandTotal],
    ])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Register</h2>
          <p className="text-sm text-gray-500">
            {format(new Date(`${firstOfMonth}T00:00:00`), "MMMM yyyy")} — full month record
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <FileText className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          Hide customers with no deliveries
        </label>
      </div>

      {truncated && (
        <div className="flex gap-2 items-start bg-amber-50 text-amber-800 rounded-md p-3 text-sm print:hidden">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Showing {deliveryData!.deliveries.length} of {deliveryData!.total} entries — this month
            is too large to load in one go, so the totals below are incomplete.
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-12">Loading register...</p>
      ) : !visible.length ? (
        <p className="text-center text-sm text-gray-400 py-12">No customers to show</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
            <table className="text-xs border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-gray-100 text-gray-600">
                  <th className="sticky left-0 z-30 bg-gray-100 w-10 px-1 py-2 text-center font-semibold border-r border-b-2 border-gray-300">
                    Sr.
                  </th>
                  <th className="sticky left-10 z-30 bg-gray-100 min-w-[150px] px-2 py-2 text-left font-semibold border-r-2 border-b-2 border-gray-300">
                    Customer
                  </th>
                  {days.map((d) => {
                    const isToday = `${month}-${String(d).padStart(2, "0")}` === todayKey
                    return (
                      <th
                        key={d}
                        className={`w-7 px-0 py-2 text-center font-semibold border-r border-b-2 border-gray-300 tabular-nums ${
                          isToday ? "bg-blue-100 text-blue-700" : ""
                        }`}
                      >
                        {d}
                      </th>
                    )
                  })}
                  <th className="w-12 px-1 py-2 text-center font-semibold border-b-2 border-l-2 border-gray-300 bg-gray-200">
                    Tot
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const stripe = i % 2 ? "bg-gray-50" : "bg-white"
                  return (
                    <tr key={r.id} className="border-b border-gray-200">
                      <td className={`sticky left-0 z-10 ${stripe} px-1 py-1 text-center text-gray-400 tabular-nums border-r border-gray-200`}>
                        {i + 1}
                      </td>
                      <td className={`sticky left-10 z-10 ${stripe} px-2 py-1 font-medium text-gray-900 border-r-2 border-gray-300 whitespace-nowrap`}>
                        {r.name}
                      </td>
                      {days.map((d) => {
                        const jugs = r.byDay.get(d)
                        return (
                          <td
                            key={d}
                            className={`${stripe} px-0 py-1 text-center border-r border-gray-100 tabular-nums ${
                              jugs ? "font-bold text-green-700" : "text-gray-200"
                            }`}
                          >
                            {jugs ?? "·"}
                          </td>
                        )
                      })}
                      <td className={`${stripe} px-1 py-1 text-center font-bold tabular-nums border-l-2 border-gray-300`}>
                        {r.total || <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                  <td className="sticky left-0 z-30 bg-gray-100 px-1 py-2 text-center text-gray-400">—</td>
                  <td className="sticky left-10 z-30 bg-gray-100 px-2 py-2 border-r-2 border-gray-300">TOTAL</td>
                  {dayTotals.map((t, i) => (
                    <td key={i} className="px-0 py-2 text-center tabular-nums border-r border-gray-200">
                      {t || <span className="text-gray-300">·</span>}
                    </td>
                  ))}
                  <td className="px-1 py-2 text-center tabular-nums text-green-700 border-l-2 border-gray-300 bg-gray-200">
                    {grandTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-gray-400 print:hidden">
        Each cell is that day's jug count. Multiple entries on the same day are added together.
        Printing works best in landscape.
      </p>
    </div>
  )
}
