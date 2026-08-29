import { useEffect, useState } from "react"
import { Plus, Trash2, Home, Heart, PiggyBank, Tv, Zap, MoreHorizontal } from "lucide-react"
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

const PRESET_ALLOCATIONS: AllocationPreset[] = [
  { id: "rent", kind: "fixed", label: "Rent / Housing", icon: Home },
  { id: "savings", kind: "savings", label: "Savings Vault", icon: PiggyBank },
  { id: "utilities", kind: "fixed", label: "Utilities & Bills", icon: Zap },
  { id: "subscriptions", kind: "subscriptions", label: "Subscriptions", icon: Tv },
  { id: "family", kind: "family", label: "Family Support", icon: Heart },
  { id: "custom", kind: "other", label: "Custom", icon: MoreHorizontal }
]

type AllocationDraft = {
  presetId: string
  kind: AllocationKind
  label: string
  amount: string
  isCustom: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycleId: number
  currency: string
  initialGross: number
  initialSweepPct: number
  initialAllocations: { kind: AllocationKind; label: string; amountMinor: number }[]
  onSave: (input: {
    id: number
    gross?: number
    sweepPct?: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => Promise<boolean>
}

const defaultAllocation = (): AllocationDraft => ({
  presetId: "custom",
  kind: "fixed",
  label: "",
  amount: "",
  isCustom: true
})

export const EditAllocationsDialog = ({
  open,
  onOpenChange,
  cycleId,
  currency,
  initialGross,
  initialSweepPct,
  initialAllocations,
  onSave
}: Props) => {
  const [gross, setGross] = useState("")
  const [sweepPct, setSweepPct] = useState("50")
  const [allocations, setAllocations] = useState<AllocationDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setGross(initialGross ? String(initialGross) : "")
    setSweepPct(String(initialSweepPct ?? 50))
    if (initialAllocations && initialAllocations.length > 0) {
      setAllocations(
        initialAllocations.map((a) => {
          const matched =
            PRESET_ALLOCATIONS.find((p) => p.label.toLowerCase() === a.label.toLowerCase()) ??
            PRESET_ALLOCATIONS.find((p) => p.kind === a.kind && p.id !== "custom" && p.kind !== "fixed")
          return {
            presetId: matched ? matched.id : "custom",
            kind: a.kind,
            label: a.label,
            amount: String(a.amountMinor / 100),
            isCustom: !matched || matched.id === "custom"
          }
        })
      )
    } else {
      setAllocations([])
    }
  }, [open, initialGross, initialSweepPct, initialAllocations])

  const grossValue = Number(gross)
  const grossValid = Boolean(gross) && Number.isFinite(grossValue) && grossValue > 0
  const canSubmit = grossValid && !saving

  const handlePresetChange = (index: number, presetId: string) => {
    const preset = PRESET_ALLOCATIONS.find((p) => p.id === presetId)
    if (!preset) return

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

  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  const remainingPool = Math.max(0, grossValue - totalAllocated)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    const ok = await onSave({
      id: cycleId,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Cycle Allocations</DialogTitle>
          <DialogDescription>
            Update your income and off-the-top allocations (Needs Reserve, Rent, Savings).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-gross">Monthly Income / Salary ({currency})</Label>
            <Input
              id="edit-gross"
              type="number"
              inputMode="decimal"
              step="any"
              placeholder="e.g. 60000"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Off-the-top Allocations</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAllocation} className="h-7 text-xs">
                <Plus className="mr-1 size-3.5" />
                Add Allocation
              </Button>
            </div>

            {allocations.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                No allocations set yet. Click &quot;Add Allocation&quot; to protect Rent, Needs Reserve, or Savings.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {allocations.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Select value={a.presetId} onValueChange={(val) => handlePresetChange(i, val)}>
                      <SelectTrigger className="w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESET_ALLOCATIONS.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id} className="text-xs">
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {a.isCustom ? (
                      <Input
                        placeholder="Label"
                        value={a.label}
                        onChange={(e) => updateCustomLabel(i, e.target.value)}
                        className="flex-1 text-xs"
                      />
                    ) : (
                      <div className="flex-1 truncate px-2 text-xs font-medium text-muted-foreground">
                        {a.label}
                      </div>
                    )}

                    <Input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      placeholder="Amount"
                      value={a.amount}
                      onChange={(e) => updateAllocationAmount(i, e.target.value)}
                      className="w-24 text-xs font-semibold"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAllocation(i)}
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {grossValid && (
            <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">Discretionary Pool:</span>
              <span className="font-bold text-foreground">
                {currency} {remainingPool.toLocaleString()}
              </span>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="edit-sweep">Underspend sweep to Want Fund ({sweepPct}%)</Label>
            <Input
              id="edit-sweep"
              type="range"
              min="0"
              max="100"
              step="5"
              value={sweepPct}
              onChange={(e) => setSweepPct(e.target.value)}
            />
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
