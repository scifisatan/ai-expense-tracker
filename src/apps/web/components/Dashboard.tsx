import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { LogOut, Settings as SettingsIcon, Wallet } from "lucide-react"
import { useTransaction } from "../hooks/useTransaction"
import BalanceHero from "./BalanceHero"
import CommandBar from "./CommandBar"
import ActivityFeed from "./ActivityFeed"
import SettingsPanel from "./SettingsPanel"
import ThemeToggle from "./ThemeToggle"
import { Button } from "@web/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@web/components/ui/dropdown-menu"

const Dashboard = ({ email, onLogout }: { email: string | null; onLogout: () => void }) => {
  const {
    transactions,
    categories,
    summary,
    isLoading,
    status,
    createTransaction,
    addFromText,
    updateTransaction,
    deleteTransactions
  } = useTransaction()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const currency = summary?.currency ?? "USD"

  // Surface the hook's status string as a toast (success unless it reads like a failure).
  useEffect(() => {
    if (!status) return
    if (/fail|error|no transactions|set your groq/i.test(status)) toast.error(status)
    else toast.success(status)
  }, [status])

  const todayDeltaMinor = useMemo(() => {
    const today = new Date().toDateString()
    return transactions.reduce((acc, t) => {
      if (new Date(t.occurredAt).toDateString() !== today) return acc
      return acc + (t.type === "Income" ? t.amountMinor : -t.amountMinor)
    }, 0)
  }, [transactions])

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">Budget</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                    {email?.[0] ?? "?"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {email && (
                  <>
                    <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                      {email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <SettingsIcon className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:py-7">
        <BalanceHero
          netMinor={summary?.net ?? 0}
          todayDeltaMinor={todayDeltaMinor}
          incomeMinor={summary?.income ?? 0}
          expenseMinor={summary?.expense ?? 0}
          currency={currency}
        />

        <CommandBar
          categories={categories}
          currency={currency}
          onCreate={createTransaction}
          onAddFromText={addFromText}
        />

        <ActivityFeed
          transactions={transactions}
          categories={categories}
          currency={currency}
          isLoading={isLoading}
          onUpdate={updateTransaction}
          onDelete={(id) => deleteTransactions([id])}
        />
      </main>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export default Dashboard
