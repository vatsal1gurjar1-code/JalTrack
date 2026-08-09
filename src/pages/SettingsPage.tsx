import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchSettings, updateSettings } from "@/api/settings"
import { applyPriceToAll } from "@/api/customers"
import {
  renderTemplate,
  templateKey,
  DEFAULT_TEMPLATES,
  PLACEHOLDERS,
  LANGUAGES,
  type Lang,
} from "@/lib/message"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Save, LogOut, Users } from "lucide-react"

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [defaultPrice, setDefaultPrice] = useState("")
  const [lang, setLang] = useState<Lang>("en")
  const [templates, setTemplates] = useState<Record<Lang, string>>(DEFAULT_TEMPLATES)
  const template = templates[lang]

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  })

  useEffect(() => {
    if (!data) return
    if (data.default_jug_price) setDefaultPrice(data.default_jug_price)
    setTemplates({
      en: data[templateKey("en")] || DEFAULT_TEMPLATES.en,
      gu: data[templateKey("gu")] || DEFAULT_TEMPLATES.gu,
    })
  }, [data])

  const setTemplate = (value: string) => setTemplates((t) => ({ ...t, [lang]: value }))

  const saveMut = useMutation({
    mutationFn: () => updateSettings({ default_jug_price: defaultPrice }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  })

  const applyMut = useMutation({
    mutationFn: () => applyPriceToAll(Number(defaultPrice)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  })

  // Saves both languages together, so switching tabs can't quietly drop an edit.
  const msgMut = useMutation({
    mutationFn: () =>
      updateSettings({ [templateKey("en")]: templates.en, [templateKey("gu")]: templates.gu }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  })

  const preview = renderTemplate(template, {
    name: "રમેશ પટેલ",
    month: "August 2026",
    jugs: 24,
    rate: 30,
    total: 720,
  })

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Price per Jug (Rs.)
            </label>
            <Input
              type="number"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              placeholder="e.g. 30"
              min={1}
            />
            <p className="text-xs text-gray-400 mt-1">
              Rate given to <b>newly added</b> customers. Existing customers keep the price
              they already have - change those on the Customers list.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="w-4 h-4" />
              {saveMut.isPending ? "Saving..." : "Save Settings"}
            </Button>
            <Button
              variant="outline"
              disabled={applyMut.isPending || !Number(defaultPrice)}
              onClick={() => {
                if (confirm(`Set EVERY customer to Rs. ${defaultPrice} per jug?\n\nThis overwrites negotiated rates too and cannot be undone.`))
                  applyMut.mutate()
              }}
            >
              <Users className="w-4 h-4" />
              {applyMut.isPending ? "Applying..." : "Apply to all customers"}
            </Button>
          </div>
          {saveMut.isSuccess && <p className="text-sm text-green-600">Saved!</p>}
          {applyMut.isSuccess && <p className="text-sm text-green-600">All customers repriced.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp Bill Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1 border-b border-gray-200">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
                  lang === l.code
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={9}
            className="w-full rounded-md border border-gray-300 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400">
            Both languages are saved together. Only the placeholders must stay in English:{" "}
            {PLACEHOLDERS.map((p) => (
              <code key={p} className="bg-gray-100 rounded px-1 mx-0.5">{`{${p}}`}</code>
            ))}
          </p>

          <div>
            <p className="text-xs text-gray-400 mb-1">Preview</p>
            <div className="bg-[#dcf8c6] rounded-lg p-3 text-sm whitespace-pre-wrap text-gray-800">
              {preview}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => msgMut.mutate()} disabled={msgMut.isPending}>
              <Save className="w-4 h-4" />
              {msgMut.isPending ? "Saving..." : "Save Message"}
            </Button>
            <Button variant="outline" onClick={() => setTemplate(DEFAULT_TEMPLATES[lang])}>
              Reset
            </Button>
          </div>
          {msgMut.isSuccess && <p className="text-sm text-green-600">Saved!</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <p className="text-gray-400">Logged in as</p>
            <p className="font-medium text-gray-900">{user?.name} ({user?.username})</p>
          </div>
          <Button variant="destructive" onClick={logout}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
