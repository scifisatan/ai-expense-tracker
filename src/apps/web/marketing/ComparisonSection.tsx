import { XCircle, CheckCircle2 } from "lucide-react"

export const ComparisonSection = () => {
  const OLD_WAY = [
    "Manually sorting receipts into 20 strict categories (Groceries, Dining, Entertainment...)",
    "Feeling guilty every time you buy a coffee or treat a friend",
    "One weekend slip-up blows your whole monthly spreadsheet, causing you to abandon it",
    "Saving 'whatever is left at the end of the month' — which is usually $0",
    "Friction-heavy apps that require typing passwords and bank sync tokens that constantly break"
  ]

  const PACER_WAY = [
    "One single number: how much you can spend today without touching tomorrow's cash",
    "Savings & rent are locked safely off the top — everything in your daily number is 100% guilt-free",
    "Dynamic amortization: overspending today is gently spread across the remaining cycle",
    "Daily underspend automatically sweeps into your Want Fund to buy items on your wishlist",
    "Instant 2-second capture via text or voice directly in Telegram"
  ]

  return (
    <section id="comparison" className="border-t bg-muted/20 py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Why Pacer Works</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Forget complex budget spreadsheets.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Traditional budgeting forces you to act like an accountant. Pacer turns your money into a clear daily pace.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Old Traditional Budgeting */}
          <div className="space-y-4 rounded-3xl border border-destructive/20 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="size-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">Traditional Budgeting Apps</h3>
            </div>
            <ul className="space-y-3 pt-2 text-xs text-muted-foreground sm:text-sm">
              {OLD_WAY.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* The Pacer Way */}
          <div className="space-y-4 rounded-3xl border border-primary/30 bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CheckCircle2 className="size-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">The Pacer Method</h3>
            </div>
            <ul className="space-y-3 pt-2 text-xs text-foreground sm:text-sm">
              {PACER_WAY.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 font-medium">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
