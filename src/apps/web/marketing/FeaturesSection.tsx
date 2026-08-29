import { Compass, Gift, MessageCircle, PiggyBank, ShieldCheck, Flame } from "lucide-react"

export const FeaturesSection = () => {
  const FEATURES = [
    {
      icon: Compass,
      title: "Today's Number",
      description: "One clear daily allowance calculated every morning based on what's left in your pay period. Never borrow from tomorrow.",
      badge: "Core Loop"
    },
    {
      icon: Gift,
      title: "Intentional Wishlist & Sweeps",
      description: "Spend less than your daily number? The surplus sweeps into your Want Fund to buy items on your wishlist guilt-free.",
      badge: "Rewards"
    },
    {
      icon: MessageCircle,
      title: "Telegram Bot Integration",
      description: "Send 'Coffee 4.50' or a quick voice note right inside Telegram. Everything syncs instantly with your web dashboard.",
      badge: "Instant Capture"
    },
    {
      icon: PiggyBank,
      title: "Pay Yourself First",
      description: "Lock away 20% into your Savings Vault the second your paycheck lands, completely protected from everyday discretionary spending.",
      badge: "Wealth"
    },
    {
      icon: ShieldCheck,
      title: "Cooling-Off Periods",
      description: "Prevent impulse buying with configurable waiting timers on your wishlist items. Only buy what you truly value.",
      badge: "Mindfulness"
    },
    {
      icon: Flame,
      title: "End-of-Cycle Rollover",
      description: "Review your performance at the end of each cycle with 1-click template rollover so your financial momentum never stops.",
      badge: "Analytics"
    }
  ]

  return (
    <section id="features" className="border-t py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Features</h2>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Built for peace of mind, not bookkeeping.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Everything you need to master your personal finances without feeling restricted.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-3xl border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {f.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{f.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
