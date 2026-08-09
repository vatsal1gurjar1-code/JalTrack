import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchCustomer, updateCustomer, deleteCustomer } from "@/api/customers"
import { fetchDeliveries } from "@/api/deliveries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit2, Save, Trash2 } from "lucide-react"
import { format, endOfMonth } from "date-fns"

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const customerId = Number(id)

  const [editing, setEditing] = useState(false)
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"))

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => fetchCustomer(customerId),
  })

  const { data: deliveryData } = useQuery({
    queryKey: ["deliveries", customerId, month],
    queryFn: () =>
      fetchDeliveries({
        customer_id: customerId,
        from: `${month}-01`,
        to: format(endOfMonth(new Date(`${month}-01T00:00:00`)), "yyyy-MM-dd"),
        limit: 500,
      }),
  })

  const [form, setForm] = useState<Record<string, string | number | undefined>>({})

  const updateMut = useMutation({
    mutationFn: (data: Record<string, string | number | undefined>) => updateCustomer(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] })
      setEditing(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteCustomer(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      navigate("/customers")
    },
  })

  if (isLoading) return <p className="text-center py-20 text-gray-400">Loading...</p>
  if (!customer) return <p className="text-center py-20 text-gray-400">Customer not found</p>

  const monthlyJugs = (deliveryData?.deliveries ?? []).reduce((s, d) => s + d.jug_count, 0)

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">{customer.name}</CardTitle>
          <div className="flex gap-2">
            {editing ? (
              <Button
                size="sm"
                onClick={() => updateMut.mutate(form)}
                disabled={updateMut.isPending}
              >
                <Save className="w-4 h-4" /> Save
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setEditing(true); setForm(customer as any) }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { if (confirm("Deactivate this customer?")) deleteMut.mutate() }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
              <div className="grid grid-cols-2 gap-3">
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
                <Input value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="Area" />
              </div>
              <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" />
              <Input type="number" value={form.default_jug_price ?? ""} onChange={(e) => setForm({ ...form, default_jug_price: e.target.value ? Number(e.target.value) : undefined })} placeholder="Price per jug" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Phone</p>
                <p className="text-gray-900">{customer.phone || "-"}</p>
              </div>
              <div>
                <p className="text-gray-400">Area</p>
                <p className="text-gray-900">{customer.area || "-"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-400">Address</p>
                <p className="text-gray-900">{customer.address || "-"}</p>
              </div>
              <div>
                <p className="text-gray-400">Price per Jug</p>
                <p className="text-gray-900">Rs. {customer.default_jug_price}</p>
              </div>
              <div>
                <p className="text-gray-400">Status</p>
                <Badge variant={customer.is_active ? "success" : "destructive"}>
                  {customer.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Delivery History</CardTitle>
          <div className="flex items-center gap-3">
            <Badge variant="default">{monthlyJugs} jugs this month</Badge>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!deliveryData?.deliveries?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No deliveries this month</p>
          ) : (
            <div className="space-y-1">
              {deliveryData.deliveries.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50 text-sm">
                  <span className="text-gray-600">
                    {d.delivered_at ? format(new Date(d.delivered_at), "d MMM, h:mm a") : d.delivery_date}
                  </span>
                  <Badge variant="default">+{d.jug_count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
