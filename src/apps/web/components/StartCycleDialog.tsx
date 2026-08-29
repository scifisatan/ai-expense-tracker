import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
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

type AllocationDraft = { kind: AllocationKind; label: string; amount: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (input: {
    startDate: string
    endDate: string
    gross: number
    sweepPct: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => Promise<boolean>
}

const ALLOCATION_KINDS: { value: AllocationKind; label: string }[] = [
  { value: "family", label: "Family" },
  { value: "savings", label: "Savings" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "fixed", label: "Fixed bill" },
  { value: "needs_reserve", label: "Needs reserve" },
  { value: "other", label: "Other" }
]

const todayIso = () => new Date().toLocaleDateString("en-CA")

const emptyAllocation = (): AllocationDraft => ({ kind: "other", label: "", amount: "" })

// One income period: gross + off-the-top allocations + sweep percentage. This
// is the only place a cycle gets created — from TodayCard's empty state.
const StartCycleDialog = ({ open, onOpenChange, onStart }: Props) => {
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState("")
  const [gross, setGross] = useState("")
  const [sweepPct, setSweepPct] = useState("50")
  const [allocations, setAllocations] = useState<AllocationDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStartDate(todayIso())
    setEndDate("")
    setGross("")
    setSweepPct("50")
    setAllocations([])
  }, [open])

  const grossValue = Number(gross)
  const grossValid = Boolean(gross) && Number.isFinite(grossValue) && grossValue > 0
  const datesValid = Boolean(startDate) && Boolean(endDate) && endDate >= startDate
  const canSubmit = grossValid && datesValid && !saving

  const updateAllocation = (index: number, patch: Partial<AllocationDraft>) => {
    setAllocations((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  const removeAllocation = (index: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== index))
  }

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
        .map((a) => ({ kind: a.kind, label: a.label.trim(), amount: Number(a.amount) }))
    })
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a pacing cycle</DialogTitle>
          <DialogDescription>
            Set your income and what's spoken for. Everything left gets split evenly across the
            days you pick.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
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

          <div className="grid gap-1.5">
            <Label htmlFor="cycle-gross">Income</Label>
            <Input
              id="cycle-gross"
              inputMode="decimal"
              placeholder="0.00"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cycle-sweep">Sweep leftover into Want Fund (%)</Label>
            <Input
              id="cycle-sweep"
              type="number"
              min={0}
              max={100}
              value={sweepPct}
              onChange={(e) => setSweepPct(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Off-the-top allocations</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAllocations((prev) => [...prev, emptyAllocation()])}
              >
                <Plus className="size-3.5" /> Add
              </Button>
            </div>

            {allocations.map((allocation, index) => (
              <div key={index} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
                <Select
                  value={allocation.kind}
                  onValueChange={(value) => updateAllocation(index, { kind: value as AllocationKind })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOCATION_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Rent"
                  value={allocation.label}
                  onChange={(e) => updateAllocation(index, { label: e.target.value })}
                />
                <Input
                  className="w-24"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={allocation.amount}
                  onChange={(e) => updateAllocation(index, { amount: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => removeAllocation(index)}
                  aria-label="Remove allocation"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
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
