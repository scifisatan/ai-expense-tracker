import { useState } from "react"
import { toast } from "sonner"
import { Wallet } from "lucide-react"
import { trpc } from "@web/trpc"
import { Button } from "@web/components/ui/button"
import { Label } from "@web/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@web/components/ui/select"
import { CURRENCIES, TIMEZONES, guessCurrency, guessTimezone } from "@web/lib/locale"

const OnboardingScreen = ({ onDone }: { onDone: () => void }) => {
  const [currency, setCurrency] = useState(() => {
    const guess = guessCurrency()
    return CURRENCIES.includes(guess) ? guess : "USD"
  })
  const [timezone, setTimezone] = useState(() => guessTimezone())

  const complete = trpc.settings.completeOnboarding.useMutation()

  // The guessed timezone may not be in our curated list; keep it selectable.
  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]

  const submit = async () => {
    try {
      await complete.mutateAsync({ currency, timezone })
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save — please try again.")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">Welcome to Budget</h1>
            <p className="text-sm text-muted-foreground">
              Set your currency and timezone to get started.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="onboarding-currency" className="w-full">
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
          <p className="text-xs text-muted-foreground">
            Pick the currency you'll track in — this can't be changed once you've added
            transactions.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="onboarding-timezone">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="onboarding-timezone" className="w-full">
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
          <p className="text-xs text-muted-foreground">You can change this later in Settings.</p>
        </div>

        <Button onClick={submit} disabled={complete.isPending} className="w-full">
          {complete.isPending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  )
}

export default OnboardingScreen
