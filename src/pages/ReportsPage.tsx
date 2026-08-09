import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchMonthlySummary, exportCsv, type CustomerMonthlySummary } from "@/api/reports"
import { fetchSettings } from "@/api/settings"
import { fetchSentBills, markBillSent, unmarkBillSent } from "@/api/bills"
import {
  renderTemplate,
  waLink,
  templateKey,
  DEFAULT_TEMPLATES,
  LANGUAGES,
  type Lang,
} from "@/lib/message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, FileText, MessageCircle, Copy, Check } from "lucide-react"
import { format } from "date-fns"

function BillActions({
  row,
  template,
  monthLabel,
  sentAt,
  onMark,
  onUnmark,
}: {
  row: CustomerMonthlySummary
  template: string
  monthLabel: string
  sentAt?: string
  onMark: () => void
  onUnmark: () => void
}) {
  const [copied, setCopied] = useState(false)

  const text = renderTemplate(template, {
    name: row.customer_name,
    month: monthLabel,
    jugs: row.total_jugs,
    rate: row.price_per_jug,
    total: row.amount_due,
  })
  const link = waLink(row.phone, text)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onMark()
  }

  return (
    <div className="flex justify-end items-center gap-1">
      {sentAt && (
        <button
          onClick={onUnmark}
          title={`Sent ${format(new Date(sentAt), "d MMM, h:mm a")} — click to mark as not sent`}
          className="inline-flex items-center gap-1 h-6 px-1.5 rounded border border-green-200 bg-green-50 text-[11px] text-green-700 hover:bg-green-100 cursor-pointer whitespace-nowrap"
        >
          <Check className="w-3 h-3" /> Sent
        </button>
      )}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onMark}
          title={`WhatsApp ${row.customer_name}`}
        >
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 hover:text-green-700">
            <MessageCircle className="w-4 h-4" />
          </Button>
        </a>
      ) : (
        <span
          title="No phone number saved for this customer"
          className="inline-flex items-center justify-center h-7 w-7 text-gray-200"
        >
          <MessageCircle className="w-4 h-4" />
        </span>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
        title="Copy the message"
        onClick={copy}
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  )
}

export default function ReportsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"))
  const [overrideOn, setOverrideOn] = useState(false)
  const [overridePrice, setOverridePrice] = useState(0)
  const [lang, setLang] = useState<Lang>("en")
  const [hideSent, setHideSent] = useState(false)
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings })
  const standardRate = Number(settings?.default_jug_price ?? 0)
  const template = settings?.[templateKey(lang)] || DEFAULT_TEMPLATES[lang]
  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy")

  useEffect(() => {
    if (standardRate) setOverridePrice(standardRate)
  }, [standardRate])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["report", month, overrideOn ? overridePrice : null],
    queryFn: () => fetchMonthlySummary(month, overrideOn ? overridePrice : null),
    enabled: false,
  })

  const { data: sent } = useQuery({
    queryKey: ["bill-sends", month],
    queryFn: () => fetchSentBills(month),
  })

  const invalidateSends = () => queryClient.invalidateQueries({ queryKey: ["bill-sends", month] })
  const markMut = useMutation({ mutationFn: (id: number) => markBillSent(id, month), onSuccess: invalidateSends })
  const unmarkMut = useMutation({ mutationFn: (id: number) => unmarkBillSent(id, month), onSuccess: invalidateSends })

  const handleGenerate = () => refetch()

  const sentCount = data?.customers.filter((c) => sent?.has(c.customer_id)).length ?? 0
  const rows = hideSent
    ? (data?.customers ?? []).filter((c) => !sent?.has(c.customer_id))
    : data?.customers ?? []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Monthly Report</h2>
        <p className="text-sm text-gray-500">Generate summary with billing</p>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="flex-1 w-full">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <input
                  type="checkbox"
                  checked={overrideOn}
                  onChange={(e) => setOverrideOn(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                Charge everyone one rate
              </label>
              <Input
                type="number"
                value={overridePrice}
                onChange={(e) => setOverridePrice(Number(e.target.value))}
                min={1}
                disabled={!overrideOn}
                className={overrideOn ? "" : "bg-gray-50 text-gray-400"}
              />
            </div>
            <Button onClick={handleGenerate} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? "Loading..." : "Generate"}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {overrideOn
              ? `Every customer will be billed at Rs. ${overridePrice}, ignoring their own rate.`
              : "Each customer is billed at their own rate. Tick the box only to override that for this one bill."}
          </p>
        </CardContent>
      </Card>

      {data && (
        <>
          {/* Summary stats */}
          <div className="flex gap-3">
            <Card className="flex-1">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{data.grand_total_jugs}</p>
                <p className="text-xs text-gray-500">Total Jugs</p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">Rs. {data.grand_total_amount.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500">Total Amount</p>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {sentCount}<span className="text-gray-300">/{data.customers.length}</span>
                </p>
                <p className="text-xs text-gray-500">Bills Sent</p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Customer-wise Summary</CardTitle>
              <div className="flex gap-2 print:hidden">
                <Button size="sm" variant="outline" onClick={() => exportCsv(data)}>
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <FileText className="w-4 h-4" /> PDF
                </Button>
              </div>
            </CardHeader>

            {/* Messaging controls */}
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 pb-3 print:hidden">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Message language
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={hideSent}
                  onChange={(e) => setHideSent(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                Hide already sent
              </label>
              {hideSent && rows.length === 0 && (
                <span className="text-sm text-green-600 font-medium">All bills sent 🎉</span>
              )}
            </div>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-200">
                      <th className="text-left px-4 py-2 font-medium text-gray-500">#</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Customer</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 hidden sm:table-cell">Area</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500">Jugs</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500">Rate</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500">Amount</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-500 print:hidden">Send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c, i) => (
                      <tr
                        key={c.customer_id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          sent?.has(c.customer_id) ? "bg-green-50/40" : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{c.customer_name}</td>
                        <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">{c.area || "-"}</td>
                        <td className="px-4 py-2 text-right">{c.total_jugs}</td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {c.price_per_jug !== standardRate ? (
                            <Badge variant="outline" className="text-[10px]">Rs.{c.price_per_jug}</Badge>
                          ) : (
                            `Rs.${c.price_per_jug}`
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">Rs. {c.amount_due.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-1 print:hidden">
                          <BillActions
                            row={c}
                            template={template}
                            monthLabel={monthLabel}
                            sentAt={sent?.get(c.customer_id)}
                            onMark={() => markMut.mutate(c.customer_id)}
                            onUnmark={() => unmarkMut.mutate(c.customer_id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-3" colSpan={3}>TOTAL</td>
                      <td className="px-4 py-3 text-right">{data.grand_total_jugs}</td>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-right text-green-600">Rs. {data.grand_total_amount.toLocaleString("en-IN")}</td>
                      <td className="print:hidden"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
