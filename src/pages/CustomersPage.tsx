import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { fetchCustomers, createCustomer, updateCustomer, type Customer, type CustomerCreate } from "@/api/customers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ImportCustomers from "@/components/ImportCustomers"
import { Search, Plus, Phone, MapPin, ChevronRight, X, FileUp } from "lucide-react"

/** Tap-to-edit rate. Lives inside a row that navigates on click, hence the stopPropagation. */
function InlinePrice({ customer }: { customer: Customer }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const queryClient = useQueryClient()

  const mut = useMutation({
    mutationFn: (price: number) => updateCustomer(customer.id, { default_jug_price: price }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })

  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (Number.isFinite(n) && n > 0 && n !== Number(customer.default_jug_price)) mut.mutate(n)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="decimal"
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
        className="w-16 h-6 rounded border border-blue-400 px-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setDraft(String(customer.default_jug_price))
        setEditing(true)
      }}
      title="Tap to change this customer's rate"
      className="h-6 px-2 rounded border border-gray-200 text-[11px] text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
    >
      Rs.{mut.isPending ? draft : customer.default_jug_price}
      {mut.isPending && <span className="text-gray-300">…</span>}
    </button>
  )
}

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => fetchCustomers({ search: search || undefined, active: true, limit: 200 }),
  })

  const addMut = useMutation({
    mutationFn: (data: CustomerCreate) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      setShowForm(false)
    },
  })

  const [form, setForm] = useState<CustomerCreate>({ name: "" })

  const handleAdd = () => {
    if (!form.name.trim()) return
    addMut.mutate(form)
    setForm({ name: "" })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500">{data?.total ?? 0} active customers</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => (setShowImport(!showImport), setShowForm(false))}
          >
            <FileUp className="w-4 h-4" /> Import
          </Button>
          <Button onClick={() => (setShowForm(!showForm), setShowImport(false))} size="sm">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancel" : "Add"}
          </Button>
        </div>
      </div>

      {showImport && <ImportCustomers onClose={() => setShowImport(false)} />}

      {/* Add customer form */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Customer name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Phone" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Area / Route" value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <Input placeholder="Address" value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Price/jug (blank = default)" value={form.default_jug_price ?? ""} onChange={(e) => setForm({ ...form, default_jug_price: e.target.value ? Number(e.target.value) : undefined })} />
              <Input placeholder="Notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button onClick={handleAdd} disabled={addMut.isPending || !form.name.trim()} className="w-full">
              {addMut.isPending ? "Adding..." : "Add Customer"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customer list */}
      {isLoading ? (
        <p className="text-center text-sm text-gray-400 py-12">Loading...</p>
      ) : (
        <div className="space-y-2">
          {data?.customers.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:border-blue-200 transition-colors"
              onClick={() => navigate(`/customers/${c.id}`)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      {c.area && <Badge variant="secondary" className="text-[10px]">{c.area}</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Phone className="w-3 h-3" />{c.phone}
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 truncate">
                          <MapPin className="w-3 h-3" />{c.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <InlinePrice customer={c} />
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {data?.customers.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-12">No customers found</p>
          )}
        </div>
      )}
    </div>
  )
}
