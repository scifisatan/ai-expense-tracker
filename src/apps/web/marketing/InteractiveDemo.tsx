import { useState } from "react"
import { Calculator, PiggyBank, Home, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@web/components/ui/button"

export const InteractiveDemo = () => {
  const [income, setIncome] = useState(3000)
  const [savingsPct, setSavingsPct] = useState(20)
  const [fixedBills, setFixedBills] = useState(1200)

  const savingsAmount = Math.round((income * savingsPct) / 100)
  const discretionaryPool = Math.max(0, income - savingsAmount - fixedBills)
  const dailyAllowance = Math.round(discretionaryPool / 30)
  const simulatedUnderspend = Math.round(dailyAllowance * 0.4) // Assume user spends 60%, sweeps 40%
  const monthlyWantSweep = simulatedUnderspend * 30

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
      <div className="flex flex-col gap-1 pb-6 text-left">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Calculator className="size-3.5" />
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Interactive Pacer Simulator
          </h3>
        </div>
        <p className="text-lg font-bold text-foreground sm:text-xl">
          See your guilt-free daily number in seconds
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Interactive Inputs */}
        <div className="space-y-6 lg:col-span-6">
          {/* Monthly Income Slider */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-muted-foreground">Monthly Net Paycheck</span>
              <span className="tabular font-extrabold text-foreground">${income.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={10000}
              step={100}
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
          </div>

          {/* Savings Percentage Slider */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <PiggyBank className="size-4 text-primary" /> Pay Yourself First (Savings)
              </span>
              <span className="tabular font-extrabold text-primary">
                {savingsPct}% (${savingsAmount.toLocaleString()})
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={savingsPct}
              onChange={(e) => setSavingsPct(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
          </div>

          {/* Fixed Bills Slider */}
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Home className="size-4 text-accent" /> Rent & Fixed Bills
              </span>
              <span className="tabular font-extrabold text-foreground">${fixedBills.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={200}
              max={5000}
              step={50}
              value={fixedBills}
              onChange={(e) => setFixedBills(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
            />
          </div>
        </div>

        {/* Right Output: The Resulting Pacing Cards */}
        <div className="flex flex-col justify-between space-y-4 rounded-2xl bg-muted/40 p-5 sm:p-6 lg:col-span-6">
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Daily Guilt-Free Allowance
              </span>
              <div className="tabular mt-1 text-3xl font-extrabold text-foreground sm:text-4xl">
                ${dailyAllowance} <span className="text-sm font-normal text-muted-foreground">/ day</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Spend this on coffee, lunch, and fun without touching bills or future days.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <PiggyBank className="size-3.5 text-primary" />
                  <span>Savings Vault</span>
                </div>
                <div className="tabular mt-1 text-base font-bold text-foreground">
                  +${savingsAmount}/mo
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-3.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-purple-500" />
                  <span>Want Fund Sweep</span>
                </div>
                <div className="tabular mt-1 text-base font-bold text-foreground">
                  ~${monthlyWantSweep}/mo
                </div>
              </div>
            </div>
          </div>

          <Button asChild className="w-full gap-2 rounded-xl text-xs font-bold">
            <a href="/api/auth/google">
              Start Pacing with this Plan <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
