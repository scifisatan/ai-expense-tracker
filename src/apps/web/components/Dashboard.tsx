import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Compass,
  History,
  ListTodo,
  LogOut,
  PieChart,
  Settings as SettingsIcon,
  Wallet,
  Menu,
  X,
  ChevronRight
} from "lucide-react"
import { useTransaction } from "../hooks/useTransaction"
import BalanceHero from "./BalanceHero"
import TodayCard from "./TodayCard"
import CommandBar from "./CommandBar"
import ActivityFeed from "./ActivityFeed"
import ActivityItem from "./ActivityItem"
import SettingsPanel from "./SettingsPanel"
import ThemeToggle from "./ThemeToggle"
import { QueueView } from "./QueueView"
import { Button } from "@web/components/ui/button"
import { cn } from "@web/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@web/components/ui/dropdown-menu"

type View = "dashboard" | "transactions" | "wishlist" | "overview" | "settings"

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

  const [currentView, setCurrentView] = useState<View>("dashboard")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const currency = summary?.currency ?? "USD"

  // Surface the hook's status as a toast.
  useEffect(() => {
    if (!status) return
    if (status.kind === "error") toast.error(status.text)
    else toast.success(status.text)
  }, [status])

  const todayDeltaMinor = useMemo(() => {
    const today = new Date().toDateString()
    return transactions.reduce((acc, t) => {
      if (new Date(t.occurredAt).toDateString() !== today) return acc
      return acc + (t.type === "Income" ? t.amountMinor : -t.amountMinor)
    }, 0)
  }, [transactions])

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5)
  }, [transactions])

  const NAV_ITEMS = [
    { id: "dashboard" as View, label: "Dashboard", icon: Compass, description: "Daily pacer & command center" },
    { id: "transactions" as View, label: "Transactions", icon: History, description: "Search & transaction history" },
    { id: "wishlist" as View, label: "Wishlist & Queue", icon: ListTodo, description: "Needs & Wants timeline" },
    { id: "overview" as View, label: "Overview", icon: PieChart, description: "Total balance & trends" },
    { id: "settings" as View, label: "Settings", icon: SettingsIcon, description: "Preferences & accounts" }
  ]

  const handleNavSelect = (view: View) => {
    setCurrentView(view)
    setMobileMenuOpen(false)
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ─────────────────────────────────────────────────────────────
          Desktop Left Sidebar (Fixed & Sticky)
          ───────────────────────────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r bg-card/60 p-4 md:flex lg:w-72">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wallet className="size-4" />
            </span>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-foreground">Pacer</h1>
              <p className="text-[11px] font-medium text-muted-foreground">Intentional Spending</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavSelect(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="size-3.5 opacity-70" />}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer / User Profile */}
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 truncate">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase text-foreground">
                {email?.[0] ?? "U"}
              </span>
              <span className="truncate text-xs font-medium text-muted-foreground">
                {email ?? "Account"}
              </span>
            </div>
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start gap-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          Main Application Content Area
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        {/* Mobile Top App Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">Pacer</span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account">
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-foreground">
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
                <DropdownMenuItem onSelect={() => setCurrentView("settings")}>
                  <SettingsIcon className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="border-b bg-card p-3 shadow-lg md:hidden">
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = currentView === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavSelect(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto max-w-5xl">
            {/* VIEW 1: Main Dashboard Command Center */}
            {currentView === "dashboard" && (
              <div className="space-y-6">
                {/* 2-Column Grid on Desktop */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Left Main Column: Pacer + Quick Entry */}
                  <div className="space-y-5 lg:col-span-7">
                    <TodayCard />

                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Quick Entry
                      </h3>
                      <CommandBar
                        categories={categories}
                        currency={currency}
                        onCreate={createTransaction}
                        onAddFromText={addFromText}
                      />
                    </div>
                  </div>

                  {/* Right Column: Net Balance & Macro Snapshot */}
                  <div className="space-y-5 lg:col-span-5">
                    <BalanceHero
                      balanceMinor={summary?.balance ?? 0}
                      todayDeltaMinor={todayDeltaMinor}
                      incomeMinor={summary?.income ?? 0}
                      expenseMinor={summary?.expense ?? 0}
                      currency={currency}
                    />

                    {/* Recent Activity Snapshot */}
                    <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
                      <div className="flex items-center justify-between pb-3">
                        <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentView("transactions")}
                          className="h-7 text-xs font-semibold text-primary"
                        >
                          View all
                        </Button>
                      </div>

                      {recentTransactions.length === 0 ? (
                        <p className="py-6 text-center text-xs text-muted-foreground">
                          No transactions yet today.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {recentTransactions.map((tx) => (
                            <ActivityItem
                              key={tx.id}
                              tx={tx}
                              categories={categories}
                              currency={currency}
                              onUpdate={updateTransaction}
                              onDelete={(id) => deleteTransactions([id])}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: Transactions / Full Ledger */}
            {currentView === "transactions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Transactions</h2>
                    <p className="text-xs text-muted-foreground">Search and review your full ledger history</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {transactions.length} record{transactions.length === 1 ? "" : "s"}
                  </span>
                </div>

                <ActivityFeed
                  transactions={transactions}
                  categories={categories}
                  currency={currency}
                  isLoading={isLoading}
                  onUpdate={updateTransaction}
                  onDelete={(id) => deleteTransactions([id])}
                />
              </div>
            )}

            {/* VIEW 3: Wishlist & Queue Manager */}
            {currentView === "wishlist" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Wishlist & Queue</h2>
                  <p className="text-xs text-muted-foreground">
                    Prioritize your desires with automatic daily sweeps and cooling-off timers
                  </p>
                </div>

                <QueueView currency={currency} />
              </div>
            )}

            {/* VIEW 4: Overview & Balance Analytics */}
            {currentView === "overview" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Financial Overview</h2>
                  <p className="text-xs text-muted-foreground">Macro balance and income vs expenses</p>
                </div>

                <BalanceHero
                  balanceMinor={summary?.balance ?? 0}
                  todayDeltaMinor={todayDeltaMinor}
                  incomeMinor={summary?.income ?? 0}
                  expenseMinor={summary?.expense ?? 0}
                  currency={currency}
                />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Log Transaction
                  </h3>
                  <CommandBar
                    categories={categories}
                    currency={currency}
                    onCreate={createTransaction}
                    onAddFromText={addFromText}
                  />
                </div>
              </div>
            )}

            {/* VIEW 5: Settings Panel */}
            {currentView === "settings" && (
              <SettingsPanel onClose={() => setCurrentView("dashboard")} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
