import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { bulkCreateCustomers, fetchCustomerNames, type CustomerCreate } from "@/api/customers"
import { parseCsv, rowsToCustomers, downloadCsv, TEMPLATE_HEADERS } from "@/lib/csv"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, AlertCircle, CheckCircle2, Upload } from "lucide-react"

export default function ImportCustomers({ onClose }: { onClose: () => void }) {
  const [fresh, setFresh] = useState<CustomerCreate[]>([])
  const [dupes, setDupes] = useState<string[]>([])
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")
  const [reading, setReading] = useState(false)
  const queryClient = useQueryClient()

  const handleFile = async (f: File) => {
    setError(""), setWarning(""), setFresh([]), setDupes([]), setSkipped(0), setReading(true)
    try {
      if (/\.xlsx?$/i.test(f.name)) {
        setError("Excel files can't be read directly. In Excel: File → Save As → CSV UTF-8, then pick that file.")
        return
      }
      const parsed = rowsToCustomers(parseCsv(await f.text()))
      if (parsed.error) {
        setError(parsed.error)
        return
      }
      // Skip names already in the database, and repeats within the file itself.
      const existing = await fetchCustomerNames()
      const seen = new Set<string>()
      const dup: string[] = []
      const ok: CustomerCreate[] = []
      for (const c of parsed.customers) {
        const key = c.name.trim().toLowerCase()
        if (existing.has(key) || seen.has(key)) dup.push(c.name)
        else seen.add(key), ok.push(c)
      }
      setFresh(ok), setDupes(dup), setSkipped(parsed.skipped), setWarning(parsed.warning ?? "")
    } catch {
      setError("Could not read that file. Make sure it's a plain .csv.")
    } finally {
      setReading(false)
    }
  }

  const importMut = useMutation({
    mutationFn: () => bulkCreateCustomers(fresh),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })

  if (importMut.isSuccess) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800 flex-1">
            Imported {fresh.length} customer{fresh.length === 1 ? "" : "s"}.
          </p>
          <Button size="sm" onClick={onClose}>Done</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">Import from CSV</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadCsv("jaltrack-customers-template.csv", [
                TEMPLATE_HEADERS,
                ["Ramesh Sharma", "9876543210", "12 MG Road, Flat 3B", "Sector 4", "30", ""],
              ])
            }
          >
            <Download className="w-4 h-4" /> Template
          </Button>
        </div>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
        />

        <p className="text-xs text-gray-400">
          First row must be headers. Recognised: {TEMPLATE_HEADERS.join(", ")}. Only <b>name</b> is required.
          <br />
          Gujarati names are fine — but save from Excel as <b>“CSV UTF-8”</b>, not plain “CSV”, or the
          text is lost before it reaches here.
        </p>

        {reading && <p className="text-sm text-gray-500">Reading file...</p>}

        {error && (
          <div className="flex gap-2 items-start bg-red-50 text-red-700 rounded-md p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {warning && (
          <div className="flex gap-2 items-start bg-amber-50 text-amber-800 rounded-md p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        {importMut.isError && (
          <div className="flex gap-2 items-start bg-red-50 text-red-700 rounded-md p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Import failed. Nothing was saved - check your connection and try again.</span>
          </div>
        )}

        {(fresh.length > 0 || dupes.length > 0) && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{fresh.length} to add</Badge>
              {dupes.length > 0 && <Badge variant="secondary">{dupes.length} already exist</Badge>}
              {skipped > 0 && <Badge variant="secondary">{skipped} rows had no name</Badge>}
            </div>

            {fresh.length > 0 && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Name</th>
                      <th className="text-left px-3 py-1.5 font-medium">Phone</th>
                      <th className="text-left px-3 py-1.5 font-medium">Area</th>
                      <th className="text-right px-3 py-1.5 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fresh.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-900">{c.name}</td>
                        <td className="px-3 py-1.5 text-gray-500">{c.phone || "-"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{c.area || "-"}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">
                          {c.default_jug_price ?? "default"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {fresh.length > 5 && (
                  <p className="text-xs text-gray-400 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
                    + {fresh.length - 5} more
                  </p>
                )}
              </div>
            )}

            {dupes.length > 0 && (
              <p className="text-xs text-gray-400">
                Skipping existing: {dupes.slice(0, 8).join(", ")}
                {dupes.length > 8 && ` + ${dupes.length - 8} more`}
              </p>
            )}
          </>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => importMut.mutate()}
            disabled={fresh.length === 0 || importMut.isPending}
            className="flex-1"
          >
            <Upload className="w-4 h-4" />
            {importMut.isPending ? "Importing..." : `Import ${fresh.length || ""} customers`}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}
