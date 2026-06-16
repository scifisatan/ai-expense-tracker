import {
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  MessageCircle,
  Sparkles,
  Wallet,
} from "lucide-react"

import { Button } from "@web/components/ui/button"
import { Badge } from "@web/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web/components/ui/card"
import { Separator } from "@web/components/ui/separator"
import ThemeToggle from "@web/components/ThemeToggle"
import { formatMoney } from "@web/helper"
import { cn } from "@web/lib/utils"

// Local brand lockup — mirrors the Dashboard header without sharing a component,
// so the landing and the app feel like the same product.
const Brand = () => (
  <div className="flex items-center gap-2">
    <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <Wallet className="size-4" />
    </span>
    <span className="text-base font-semibold tracking-tight">Budget</span>
  </div>
)

type Feature = {
  icon: typeof Sparkles
  title: string
  body: string
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "Type it like you'd say it",
    body: "“Lunch 12” or “Got paid 2400” — we read it and file it for you.",
  },
  {
    icon: MessageCircle,
    title: "Capture from Telegram",
    body: "Add on the go from chat. Everything stays in sync with the web.",
  },
  {
    icon: Lock,
    title: "Yours, private by default",
    body: "No setup, no API keys. Your money stays yours, not a product.",
  },
]

const FeatureCard = ({ icon: Icon, title, body }: Feature) => (
  <Card className="h-full">
    <CardHeader>
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4.5" />
      </span>
      <CardTitle className="mt-3 text-base">{title}</CardTitle>
      <CardDescription>{body}</CardDescription>
    </CardHeader>
  </Card>
)

// A purely presentational mock of the feed — no data fetching on a pre-auth route.
const PreviewRow = ({
  label,
  meta,
  amountMinor,
  income = false,
}: {
  label: string
  meta: string
  amountMinor: number
  income?: boolean
}) => (
  <div className="flex items-center gap-3">
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        income ? "bg-income-muted text-income" : "bg-expense-muted text-expense"
      )}
    >
      {income ? (
        <ArrowDownRight className="size-4" />
      ) : (
        <ArrowUpRight className="size-4" />
      )}
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{label}</p>
      <p className="truncate text-xs text-muted-foreground">{meta}</p>
    </div>
    <span
      className={cn(
        "tabular text-sm font-semibold",
        income ? "text-income" : "text-foreground"
      )}
    >
      {income ? "+" : "−"}
      {formatMoney(amountMinor, "USD")}
    </span>
  </div>
)

const Preview = () => (
  <Card className="relative overflow-hidden">
    <CardContent className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">
          Current balance
        </p>
        <p className="tabular mt-1 text-3xl font-semibold tracking-tight">
          {formatMoney(184_250, "USD")}
        </p>
      </div>
      <Separator />
      <div className="space-y-3">
        <PreviewRow label="Coffee" meta="Today · Food" amountMinor={450} />
        <PreviewRow
          label="Paycheck"
          meta="Yesterday · Income"
          amountMinor={240_000}
          income
        />
      </div>
    </CardContent>
  </Card>
)

const AuthScreen = () => {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* warm ambient glow — borrowed from BalanceHero so the page feels in-app */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between">
          <Brand />
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col">
          {/* Hero */}
          <section className="mx-auto flex w-full max-w-2xl flex-col items-center py-10 text-center sm:py-16">
            <Badge variant="secondary">Money, in plain words</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Track your money by just saying it.
            </h1>
            <p className="mt-4 max-w-md text-base text-muted-foreground text-balance sm:text-lg">
              Log spending on the web or from Telegram in plain language —
              calm, private, and always in sync.
            </p>

            <div className="mt-8 flex w-full flex-col items-center gap-3">
              {/* Server-side OAuth redirect — must stay a plain link, not a tRPC call. */}
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href="/api/auth/google">Continue with Google</a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Free. No card. Connect Telegram later.
              </p>
            </div>
          </section>

          {/* Proof row */}
          <section className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </section>

          {/* Mini preview */}
          <section className="mx-auto mt-10 w-full max-w-md sm:mt-14">
            <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
              This is what you'll see
            </p>
            <Preview />
          </section>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
          <MessageCircle className="size-3.5" />
          <span>Web and Telegram, always in sync.</span>
        </footer>
      </div>
    </div>
  )
}

export default AuthScreen
