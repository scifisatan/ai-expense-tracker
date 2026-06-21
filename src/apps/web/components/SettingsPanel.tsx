import { useState } from "react"
import { toast } from "sonner"
import { MessageCircle, Settings as SettingsIcon, Tags, Trash2, Wallet } from "lucide-react"
import { trpc } from "@web/trpc"
import type { TransactionType } from "@/shared/types"
import { formatMoney } from "@/shared/money"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import { Label } from "@web/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@web/components/ui/select"
import { cn } from "@web/lib/utils"
import { CURRENCIES, TIMEZONES } from "@web/lib/locale"

const OVERALL_BUDGET = "overall"

const SettingsPanel = ({ onClose }: { onClose: () => void }) => {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.settings.get.useQuery()
  const linksQuery = trpc.telegram.listLinks.useQuery()
  const categoriesQuery = trpc.categories.list.useQuery()
  const budgetsQuery = trpc.budgets.list.useQuery()

  const setCurrency = trpc.settings.setDefaultCurrency.useMutation()
  const updateSettings = trpc.settings.update.useMutation()
  const confirmLink = trpc.telegram.confirmLink.useMutation()
  const unlink = trpc.telegram.unlink.useMutation()
  const createCategory = trpc.categories.create.useMutation()
  const deleteCategory = trpc.categories.delete.useMutation()
  const createBudget = trpc.budgets.create.useMutation()
  const deleteBudget = trpc.budgets.remove.useMutation()

  const [code, setCode] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState<TransactionType>("Expense")
  const [newBudgetCategory, setNewBudgetCategory] = useState<string>(OVERALL_BUDGET)
  const [newBudgetAmount, setNewBudgetAmount] = useState("")

  const saveCurrency = async (currency: string) => {
    await setCurrency.mutateAsync({ currency })
    // The dashboard hero, summary stats, and activity rows all format amounts in
    // the account default currency, so invalidate them too — otherwise they keep
    // the old symbol until a full page reload.
    await Promise.all([
      settingsQuery.refetch(),
      utils.insights.summary.invalidate(),
      utils.transactions.list.invalidate()
    ])
    toast.success("Default currency updated")
  }

  const saveTimezone = async (timezone: string) => {
    await updateSettings.mutateAsync({ timezone })
    await settingsQuery.refetch()
    toast.success("Timezone updated")
  }

  const submitCode = async () => {
    if (!code.trim()) return
    try {
      await confirmLink.mutateAsync({ code: code.trim() })
      setCode("")
      await linksQuery.refetch()
      toast.success("Telegram connected")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Couldn't connect — check the code and try again."
      )
    }
  }

  const removeLink = async (chatId: number) => {
    await unlink.mutateAsync({ chatId })
    await linksQuery.refetch()
    toast.success("Disconnected")
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    await createCategory.mutateAsync({ name: newCatName.trim(), type: newCatType })
    setNewCatName("")
    await Promise.all([categoriesQuery.refetch(), utils.categories.list.invalidate()])
    toast.success("Category added")
  }

  const removeCategory = async (id: number) => {
    await deleteCategory.mutateAsync({ id })
    await Promise.all([categoriesQuery.refetch(), utils.categories.list.invalidate()])
    toast.success("Category removed")
  }

  const addBudget = async () => {
    const amount = Number(newBudgetAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    await createBudget.mutateAsync({
      amount,
      categoryId: newBudgetCategory === OVERALL_BUDGET ? null : Number(newBudgetCategory)
    })
    setNewBudgetAmount("")
    setNewBudgetCategory(OVERALL_BUDGET)
    await budgetsQuery.refetch()
    toast.success("Budget saved")
  }

  const removeBudget = async (id: number) => {
    await deleteBudget.mutateAsync({ id })
    await budgetsQuery.refetch()
    toast.success("Budget removed")
  }

  const settings = settingsQuery.data
  const categories = categoriesQuery.data?.items ?? []
  const links = linksQuery.data?.items ?? []
  const budgets = budgetsQuery.data?.items ?? []
  const expenseCategories = categories.filter((c) => c.type === "Expense")
  const categoryName = (id: number | null) =>
    id === null ? "Overall" : (categories.find((c) => c.id === id)?.name ?? "Category")

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your defaults, integrations, and categories.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="gap-0 px-6 py-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">
              <SettingsIcon />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="budgets">
              <Wallet />
              <span className="hidden sm:inline">Budgets</span>
            </TabsTrigger>
            <TabsTrigger value="telegram">
              <MessageCircle />
              <span className="hidden sm:inline">Telegram</span>
            </TabsTrigger>
            <TabsTrigger value="categories">
              <Tags />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="mt-6 flex flex-col gap-2">
            <Label htmlFor="settings-currency">Default currency</Label>
            <Select
              value={settings?.defaultCurrency ?? "USD"}
              onValueChange={saveCurrency}
              disabled={settings?.currencyLocked}
            >
              <SelectTrigger id="settings-currency" className="w-full">
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
              {settings?.currencyLocked
                ? "Locked because you already have transactions — every transaction is stored in this currency."
                : "Every transaction is stored in this currency. It locks once you add your first transaction."}
            </p>

            <Label htmlFor="settings-timezone" className="mt-4">
              Timezone
            </Label>
            <Select value={settings?.timezone ?? "UTC"} onValueChange={saveTimezone}>
              <SelectTrigger id="settings-timezone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(TIMEZONES.includes(settings?.timezone ?? "UTC")
                  ? TIMEZONES
                  : [settings!.timezone, ...TIMEZONES]
                ).map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used to resolve dates like "yesterday" and to bucket monthly summaries.
            </p>
          </TabsContent>

          {/* Budgets */}
          <TabsContent value="budgets" className="mt-6 flex flex-col gap-2">
            <Label htmlFor="settings-budget-amount">Monthly budget</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={newBudgetCategory} onValueChange={setNewBudgetCategory}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OVERALL_BUDGET}>Overall</SelectItem>
                  {expenseCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  id="settings-budget-amount"
                  type="number"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addBudget()
                  }}
                  className="flex-1 tabular sm:w-32"
                />
                <Button
                  onClick={addBudget}
                  disabled={!newBudgetAmount.trim() || createBudget.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Get a Telegram alert at 80% and 100% of each monthly budget.
            </p>

            {budgets.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {budgets.map((budget) => (
                  <li
                    key={budget.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <span className="flex items-center gap-2 truncate text-sm">
                      <span className="truncate">{categoryName(budget.categoryId)}</span>
                      <span className="tabular text-muted-foreground">
                        {formatMoney(budget.amountMinor, budget.currency)}/mo
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBudget(budget.id)}
                      aria-label={`Delete budget`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-8 text-center">
                <Wallet className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No budgets yet</p>
              </div>
            )}
          </TabsContent>

          {/* Telegram */}
          <TabsContent value="telegram" className="mt-6 flex flex-col gap-2">
            <Label htmlFor="settings-code">Connect Telegram</Label>
            <p className="text-xs text-muted-foreground">
              Send <code className="rounded bg-muted px-1 py-0.5 tabular">/link</code> to the bot,
              then enter the code it gives you.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="settings-code"
                placeholder="Enter code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCode()
                }}
                className="flex-1 tabular"
              />
              <Button onClick={submitCode} disabled={!code.trim() || confirmLink.isPending}>
                Connect
              </Button>
            </div>

            {links.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {links.map((link) => (
                  <li
                    key={link.chatId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm">
                      {link.username ? (
                        `@${link.username}`
                      ) : (
                        <span className="tabular">Chat {link.chatId}</span>
                      )}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => removeLink(link.chatId)}>
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-8 text-center">
                <MessageCircle className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No chats connected yet</p>
              </div>
            )}
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="mt-6 flex flex-col gap-2">
            <Label htmlFor="settings-cat">Categories</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="settings-cat"
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCategory()
                }}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Select
                  value={newCatType}
                  onValueChange={(v) => setNewCatType(v as TransactionType)}
                >
                  <SelectTrigger className="flex-1 sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expense">Expense</SelectItem>
                    <SelectItem value="Income">Income</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={addCategory}
                  disabled={!newCatName.trim() || createCategory.isPending}
                >
                  Add
                </Button>
              </div>
            </div>

            {categories.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <span className="flex items-center gap-2 truncate text-sm">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          cat.type === "Income" ? "bg-income" : "bg-expense"
                        )}
                      />
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={cn(
                          "text-xs",
                          cat.type === "Income" ? "text-income" : "text-expense"
                        )}
                      >
                        {cat.type}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeCategory(cat.id)}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-8 text-center">
                <Tags className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsPanel
