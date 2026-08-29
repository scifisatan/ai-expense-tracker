import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Compass,
  History,
  LayoutDashboard,
  Gift,
  PiggyBank,
  LogOut,
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
import { PacerView } from "./PacerView"
import { SavingsView } from "./SavingsView"
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

type View = "dashboard" | "pacer" | "savings" | "wishlist" | "transactions" | "settings"

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
    const todayStr = new Date().toLocaleDateString("en-CA")
    return transactions
      .filter((t) => (t.occurredAt ?? "").startsWith(todayStr))
      .reduce((sum, t) => sum + (t.type === "Income" ? t.amountMinor : -t.amountMinor), 0)
  }, [transactions])

  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5)
  }, [transactions])

  const NAV_SECTIONS = [
    {
      title: "Overview",
      items: [
        { id: "dashboard" as View, label: "Dashboard", icon: LayoutDashboard },
        { id: "transactions" as View, label: "Transactions", icon: History }
      ]
    },
    {
      title: "Pacing & Wealth",
      items: [
        { id: "pacer" as View, label: "Daily Pace", icon: Compass },
        { id: "savings" as View, label: "Savings Vault", icon: PiggyBank },
        { id: "wishlist" as View, label: "Priority Wishlist", icon: Gift }
      ]
    },
    {
      title: "Preferences",
      items: [
        { id: "settings" as View, label: "Settings", icon: SettingsIcon }
      ]
    }
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

          {/* Navigation Sections */}
          <div className="space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <span className="px-3 text-[11px] font-bold text-muted-foreground/80">
                  {section.title}
                </span>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = currentView === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavSelect(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2 text-left text-sm font-semibold transition-all",
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
            ))}
          </div>
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
          <div className="space-y-3 border-b bg-card p-4 shadow-lg md:hidden">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-muted-foreground/80">
                  {section.title}
                </span>
                <nav className="space-y-1">
                  {section.items.map((item) => {
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
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            ))}
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="w-full">
            {/* VIEW 1: Main Dashboard Command Center */}
            {currentView === "dashboard" && (
              <div className="space-y-6">
                {/* Top Metrics Overview Bar */}
                <TodayCard onNavigate={setCurrentView} />

                {/* 2-Column Grid on Desktop */}
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                  {/* Left Column: Quick Entry Command Center & Recent Activity */}
                  <div className="space-y-6 lg:col-span-7">
                    <CommandBar
                      categories={categories}
                      currency={currency}
                      onCreate={createTransaction}
                      onAddFromText={addFromText}
                    />

                    {/* Recent Activity Feed */}
                    <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                      <div className="flex items-center justify-between pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">Recent activity</h3>
                          <p className="text-xs text-muted-foreground">Your latest recorded transactions</p>
                        </div>
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

                  {/* Right Column: Net Balance & Macro Snapshot */}
                  <div className="space-y-6 lg:col-span-5">
                    <BalanceHero
                      balanceMinor={summary?.balance ?? 0}
                      todayDeltaMinor={todayDeltaMinor}
                      incomeMinor={summary?.income ?? 0}
                      expenseMinor={summary?.expense ?? 0}
                      currency={currency}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: Daily Spending Pace */}
            {currentView === "pacer" && <PacerView onNavigate={setCurrentView} />}

            {/* VIEW 3: Savings Vault */}
            {currentView === "savings" && <SavingsView onNavigate={setCurrentView} />}

            {/* VIEW 4: Transactions / Full Ledger */}
            {currentView === "transactions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Transactions</h2>
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

            {/* VIEW 5: Wishlist & Queue Manager */}
            {currentView === "wishlist" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">Priority Wishlist & Goals</h2>
                  <p className="text-xs text-muted-foreground">
                    Rank and track desired purchases funded automatically by your daily spending pace
                  </p>
                </div>

                <QueueView currency={currency} />
              </div>
            )}

            {/* VIEW 6: Settings Panel */}
            {currentView === "settings" && <SettingsPanel />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
