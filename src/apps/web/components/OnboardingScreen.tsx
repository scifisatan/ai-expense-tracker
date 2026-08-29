import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Wallet, Compass, ArrowRight, Plus, Trash2, Home, PiggyBank, Zap } from "lucide-react"
import { trpc } from "@web/trpc"
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
import { CURRENCIES, TIMEZONES, guessCurrency, guessTimezone } from "@web/lib/locale"
import { localDateString, addDays } from "@/shared/datetime"
import type { AllocationKind } from "@/shared/types"

type AllocationItem = {
  id: string
  kind: AllocationKind
  label: string
  amount: string
}

const PRESETS = [
  { id: "rent", kind: "fixed" as AllocationKind, label: "Rent / Housing", icon: Home },
  { id: "savings", kind: "savings" as AllocationKind, label: "Savings Vault", icon: PiggyBank },
  { id: "bills", kind: "fixed" as AllocationKind, label: "Utilities & Bills", icon: Zap }
]

const OnboardingScreen = ({ onDone }: { onDone: () => void }) => {
  const [step, setStep] = useState<1 | 2>(1)
  const [currency, setCurrency] = useState(() => {
    const guess = guessCurrency()
    return CURRENCIES.includes(guess) ? guess : "USD"
  })
  const [timezone, setTimezone] = useState(() => guessTimezone())
  const [salary, setSalary] = useState("")
  const [allocations, setAllocations] = useState<AllocationItem[]>([])
  const [loading, setLoading] = useState(false)

  const complete = trpc.settings.completeOnboarding.useMutation()
  const createCycle = trpc.cycles.create.useMutation()

  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]

  const salaryNum = Number(salary) || 0

  const totalAllocated = useMemo(() => {
    return allocations.reduce((acc, a) => acc + (Number(a.amount) || 0), 0)
  }, [allocations])

  const discretionaryPool = Math.max(0, salaryNum - totalAllocated)
  const dailyAllowance = Math.round(discretionaryPool / 30)

  const handleAddPreset = (preset: typeof PRESETS[0]) => {
    const exists = allocations.find((a) => a.label === preset.label)
    if (exists) return

    let defaultAmt = ""
    if (preset.id === "savings" && salaryNum > 0) {
      defaultAmt = String(Math.round(salaryNum * 0.2))
    }

    setAllocations((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        kind: preset.kind,
        label: preset.label,
        amount: defaultAmt
      }
    ])
  }

  const handleAddCustom = () => {
    setAllocations((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        kind: "fixed",
        label: "",
        amount: ""
      }
    ])
  }

  const handleUpdateAllocation = (id: string, field: "label" | "amount", val: string) => {
    setAllocations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: val } : a))
    )
  }

  const handleRemoveAllocation = (id: string) => {
    setAllocations((prev) => prev.filter((a) => a.id !== id))
  }

  const handleNextStep = () => {
    setStep(2)
  }

  const handleFinish = async (skipSalary = false) => {
    setLoading(true)
    try {
      // 1. Complete basic onboarding settings
      await complete.mutateAsync({ currency, timezone })

      if (!skipSalary && salaryNum > 0) {
        const today = localDateString(timezone)
        const endDate = addDays(timezone, today, 29)

        const cleanAllocations = allocations
          .filter((a) => a.label.trim() && Number(a.amount) > 0)
          .map((a) => ({
            kind: a.kind,
            label: a.label.trim(),
            amount: Number(a.amount)
          }))

        // 2. Start initial 30-day pacing cycle (automatically records income in ledger)
        await createCycle.mutateAsync({
          startDate: today,
          endDate,
          gross: salaryNum,
          sweepPct: 100,
          allocations: cleanAllocations
        })
      }

      toast.success("Welcome aboard! Your pacer is ready.")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't complete setup — please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="flex w-full max-w-lg flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">
              {step === 1 ? "Welcome to Pacer" : "Set Your Income & Allocations"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {step === 1
                ? "Step 1 of 2: Set your region and currency."
                : "Step 2 of 2: Enter your monthly salary and fixed expenses."}
            </p>
          </div>
        </div>

        {/* STEP 1: Region & Currency */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="onboarding-currency" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Currency
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="onboarding-currency" className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c} className="tabular">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="onboarding-timezone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Timezone
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="onboarding-timezone" className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleNextStep} className="mt-2 w-full gap-2 text-sm font-semibold">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* STEP 2: Salary + Fixed Assets / Allocations */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Salary Input */}
            <div className="space-y-2">
              <Label htmlFor="onboarding-salary" className="text-xs font-bold text-muted-foreground">
                Monthly Net Salary ({currency})
              </Label>
              <Input
                id="onboarding-salary"
                type="number"
                inputMode="decimal"
                placeholder="e.g. 60000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="tabular h-11 text-base font-bold"
                autoFocus
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[30000, 50000, 75000, 100000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSalary(String(amt))}
                    className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Off-the-Top Allocations Section */}
            <div className="space-y-3 rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-foreground">
                    Fixed bills & off-the-top allocations
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Protected funds subtracted before calculating your daily pace.
                  </p>
                </div>
              </div>

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const Icon = p.icon
                  const alreadyAdded = allocations.some((a) => a.label === p.label)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleAddPreset(p)}
                      className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <Icon className="size-3.5 text-primary" />
                      <span>+ {p.label}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={handleAddCustom}
                  className="flex items-center gap-1 rounded-full border border-dashed bg-card/60 px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-3" /> Custom
                </button>
              </div>

              {/* Allocation Rows */}
              {allocations.length > 0 && (
                <div className="space-y-2 pt-2">
                  {allocations.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Label (e.g. Rent)"
                        value={a.label}
                        onChange={(e) => handleUpdateAllocation(a.id, "label", e.target.value)}
                        className="flex-1 text-xs"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="Amount"
                        value={a.amount}
                        onChange={(e) => handleUpdateAllocation(a.id, "amount", e.target.value)}
                        className="tabular w-28 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAllocation(a.id)}
                        className="p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Calculation Summary */}
              {salaryNum > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div className="rounded-xl bg-card p-2.5">
                    <span className="text-muted-foreground">Discretionary Pool</span>
                    <p className="tabular text-sm font-bold text-foreground">
                      {currency} {discretionaryPool.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-primary/10 p-2.5">
                    <span className="text-primary font-semibold">Daily Allowance</span>
                    <p className="tabular text-sm font-extrabold text-primary">
                      {currency} {dailyAllowance.toLocaleString()} / day
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Launch Actions */}
            <div className="space-y-2 pt-1">
              <Button
                onClick={() => handleFinish(false)}
                disabled={loading || !salary.trim()}
                className="w-full gap-2 text-sm font-semibold"
              >
                <Compass className="size-4" />
                {loading ? "Setting up..." : "Launch Pacer"}
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleFinish(true)}
                disabled={loading}
                className="w-full text-xs text-muted-foreground"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OnboardingScreen
