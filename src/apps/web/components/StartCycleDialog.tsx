import { useEffect, useState } from "react"
import { Plus, Trash2, Home, Heart, PiggyBank, Tv, Zap, MoreHorizontal, Gift } from "lucide-react"
import type { AllocationKind } from "@/shared/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Label } from "@web/components/ui/label"
import { Input } from "@web/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@web/components/ui/select"

export type AllocationPreset = {
  id: string
  kind: AllocationKind
  label: string
  icon: typeof Home
}

export const PRESET_ALLOCATIONS: AllocationPreset[] = [
  { id: "rent", kind: "fixed", label: "Rent / Housing", icon: Home },
  { id: "savings", kind: "savings", label: "Savings Vault", icon: PiggyBank },
  { id: "want_fund", kind: "other", label: "Wishlist / Want Budget", icon: Gift },
  { id: "utilities", kind: "fixed", label: "Utilities & Bills", icon: Zap },
  { id: "subscriptions", kind: "subscriptions", label: "Subscriptions", icon: Tv },
  { id: "family", kind: "family", label: "Family Support", icon: Heart },
  { id: "custom", kind: "other", label: "Custom", icon: MoreHorizontal }
]

export type AllocationDraft = {
  presetId: string
  kind: AllocationKind
  label: string
  amount: string
  isCustom: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: {
    startDate?: string
    endDate?: string
    gross?: number
    sweepPct?: number
    allocations?: { kind: AllocationKind; label: string; amount: number }[]
  } | null
  onStart: (input: {
    startDate: string
    endDate: string
    gross: number
    sweepPct: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => Promise<boolean>
}

const todayIso = () => new Date().toLocaleDateString("en-CA")

const defaultAllocation = (presetId = "rent"): AllocationDraft => {
  const preset = PRESET_ALLOCATIONS.find((p) => p.id === presetId) ?? PRESET_ALLOCATIONS[0]!
  return {
    presetId: preset.id,
    kind: preset.kind,
    label: preset.label,
    amount: "",
    isCustom: preset.id === "custom"
  }
}

const defaultEndIso = (startStr?: string) => {
  const base = startStr ? new Date(startStr) : new Date()
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  return lastDay.toISOString().slice(0, 10)
}

const StartCycleDialog = ({ open, onOpenChange, initialValues, onStart }: Props) => {
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(() => defaultEndIso())
  const [gross, setGross] = useState("")
  const [sweepPct, setSweepPct] = useState("50")
  const [allocations, setAllocations] = useState<AllocationDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    if (initialValues) {
      const start = initialValues.startDate ?? todayIso()
      setStartDate(start)
      setEndDate(initialValues.endDate ?? defaultEndIso(start))
      setGross(initialValues.gross ? String(initialValues.gross) : "")
      setSweepPct(initialValues.sweepPct !== undefined ? String(initialValues.sweepPct) : "50")
      if (initialValues.allocations && initialValues.allocations.length > 0) {
        setAllocations(
          initialValues.allocations.map((a) => {
            const matched =
              PRESET_ALLOCATIONS.find((p) => p.label.toLowerCase() === a.label.toLowerCase()) ??
              PRESET_ALLOCATIONS.find((p) => p.kind === a.kind && p.id !== "custom" && p.kind !== "fixed")
            return {
              presetId: matched ? matched.id : "custom",
              kind: a.kind,
              label: a.label,
              amount: String(a.amount),
              isCustom: !matched || matched.id === "custom"
            }
          })
        )
      } else {
        setAllocations([])
      }
    } else {
      const start = todayIso()
      setStartDate(start)
      setEndDate(defaultEndIso(start))
      setGross("")
      setSweepPct("50")
      setAllocations([])
    }
  }, [open, initialValues])

  const handlePresetSelect = (index: number, presetId: string) => {
    const preset = PRESET_ALLOCATIONS.find((p) => p.id === presetId) ?? PRESET_ALLOCATIONS[0]!
    setAllocations((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a
        return {
          ...a,
          presetId,
          kind: preset.kind,
          label: preset.id === "custom" ? (a.isCustom ? a.label : "") : preset.label,
          isCustom: preset.id === "custom"
        }
      })
    )
  }

  const updateAllocationAmount = (index: number, amount: string) => {
    setAllocations((prev) => prev.map((a, i) => (i === index ? { ...a, amount } : a)))
  }

  const updateCustomLabel = (index: number, label: string) => {
    setAllocations((prev) => prev.map((a, i) => (i === index ? { ...a, label } : a)))
  }

  const removeAllocation = (index: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== index))
  }

  const addAllocation = () => {
    setAllocations((prev) => [...prev, defaultAllocation()])
  }

  const grossValue = Number(gross) || 0
  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  const remainingPool = Math.max(0, grossValue - totalAllocated)

  const canSubmit = grossValue > 0 && startDate && endDate && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    const ok = await onStart({
      startDate,
      endDate,
      gross: grossValue,
      sweepPct: Number(sweepPct) || 0,
      allocations: allocations
        .filter((a) => a.label.trim() && Number(a.amount) > 0)
        .map((a) => ({
          kind: a.kind,
          label: a.label.trim(),
          amount: Number(a.amount)
        }))
    })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a pacing cycle</DialogTitle>
          <DialogDescription>
            Set your income and off-the-top allocations. Everything remaining is split evenly across your days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cycle-start">Start date</Label>
                <Input
                  id="cycle-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cycle-end">End date</Label>
                <Input
                  id="cycle-end"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(startDate)
                  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                  setEndDate(lastDay.toISOString().slice(0, 10))
                }}
                className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                📅 End of current month
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(startDate)
                  d.setDate(d.getDate() + 29)
                  setEndDate(d.toISOString().slice(0, 10))
                }}
                className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                ⏱️ 30 days
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)
                  setStartDate(nextMonthStart.toISOString().slice(0, 10))
                  setEndDate(nextMonthEnd.toISOString().slice(0, 10))
                }}
                className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                🗓️ Next full month
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cycle-gross">Income Amount</Label>
            <Input
              id="cycle-gross"
              inputMode="decimal"
              placeholder="e.g. 50000"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="cycle-sweep">Sweep into Want Fund</Label>
              <span className="text-xs font-semibold text-muted-foreground">{sweepPct}%</span>
            </div>
            <input
              id="cycle-sweep"
              type="range"
              min={0}
              max={100}
              step={5}
              value={sweepPct}
              onChange={(e) => setSweepPct(e.target.value)}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Off-the-top allocations</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAllocation} className="h-7 text-xs">
                <Plus className="mr-1 size-3.5" /> Add
              </Button>
            </div>

            {allocations.length === 0 ? (
              <p className="rounded-xl border border-dashed py-3 text-center text-xs text-muted-foreground">
                No fixed deductions. Click "+ Add" to budget for rent, savings, or family.
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {allocations.map((allocation, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {allocation.isCustom ? (
                      <Input
                        placeholder="e.g. Loan Payment"
                        value={allocation.label}
                        onChange={(e) => updateCustomLabel(index, e.target.value)}
                        className="h-9 flex-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <Select
                        value={allocation.presetId}
                        onValueChange={(val) => handlePresetChange(index, val)}
                      >
                        <SelectTrigger className="h-9 flex-1 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_ALLOCATIONS.map((preset) => {
                            const Icon = preset.icon
                            return (
                              <SelectItem key={preset.id} value={preset.id}>
                                <div className="flex items-center gap-2">
                                  <Icon className="size-3.5 text-muted-foreground" />
                                  <span>{preset.label}</span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    )}

                    <Input
                      className="h-9 w-24 text-sm"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={allocation.amount}
                      onChange={(e) => updateAllocationAmount(index, e.target.value)}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAllocation(index)}
                      aria-label="Remove allocation"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving ? "Starting…" : "Start cycle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default StartCycleDialog
