import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, MessageCircle, Settings as SettingsIcon, Tags, Trash2 } from "lucide-react"
import { trpc } from "@web/trpc"
import type { TransactionType } from "@/shared/types"
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

const SettingsPanel = () => {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.settings.get.useQuery()
  const linksQuery = trpc.telegram.listLinks.useQuery()
  const categoriesQuery = trpc.categories.list.useQuery()

  const setCurrency = trpc.settings.setDefaultCurrency.useMutation()
  const updateSettings = trpc.settings.update.useMutation()
  const confirmLink = trpc.telegram.confirmLink.useMutation()
  const unlink = trpc.telegram.unlink.useMutation()
  const createCategory = trpc.categories.create.useMutation()
  const deleteCategory = trpc.categories.delete.useMutation()
  const deleteAccount = trpc.auth.deleteAccount.useMutation()

  const [code, setCode] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState<TransactionType>("Expense")
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Shared wrapper so no mutation can fail silently — every failure surfaces as
  // an error toast instead of an unhandled rejection.
  const attempt = async (action: () => Promise<void>, failure: string) => {
    try {
      await action()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : failure)
    }
  }

  const saveCurrency = (currency: string) =>
    attempt(async () => {
      await setCurrency.mutateAsync({ currency })
      await Promise.all([
        settingsQuery.refetch(),
        utils.transactions.summary.invalidate(),
        utils.transactions.list.invalidate(),
        utils.cycles.current.invalidate()
      ])
      toast.success("Default currency updated")
    }, "Couldn't update currency — try again.")

  const saveTimezone = (timezone: string) =>
    attempt(async () => {
      await updateSettings.mutateAsync({ timezone })
      await Promise.all([
        settingsQuery.refetch(),
        utils.transactions.summary.invalidate(),
        utils.transactions.list.invalidate(),
        utils.cycles.current.invalidate()
      ])
      toast.success("Timezone updated")
    }, "Couldn't update timezone — try again.")

  const submitCode = () => {
    if (!code.trim()) return
    attempt(async () => {
      await confirmLink.mutateAsync({ code: code.trim().toUpperCase() })
      setCode("")
      await linksQuery.refetch()
      toast.success("Telegram connected ✓")
    }, "Couldn't link Telegram — check the code and try again.")
  }

  const removeLink = (chatId: number) =>
    attempt(async () => {
      await unlink.mutateAsync({ chatId })
      await linksQuery.refetch()
      toast.success("Disconnected")
    }, "Couldn't disconnect — try again.")

  const addCategory = async () => {
    if (!newCatName.trim()) return
    await attempt(async () => {
      await createCategory.mutateAsync({ name: newCatName.trim(), type: newCatType })
      setNewCatName("")
      await Promise.all([categoriesQuery.refetch(), utils.categories.list.invalidate()])
      toast.success("Category added")
    }, "Couldn't add category — try again.")
  }

  const removeCategory = (id: number) =>
    attempt(async () => {
      await deleteCategory.mutateAsync({ id })
      await Promise.all([categoriesQuery.refetch(), utils.categories.list.invalidate()])
      toast.success("Category removed")
    }, "Couldn't remove category — try again.")

  const confirmDelete = async () => {
    try {
      await deleteAccount.mutateAsync()
      await fetch("/api/auth/logout", { method: "POST" })
      window.location.href = "/"
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete account — try again.")
    }
  }

  const settings = settingsQuery.data
  const categories = categoriesQuery.data?.items ?? []
  const links = linksQuery.data?.items ?? []

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Settings & Preferences</h2>
        <p className="text-xs text-muted-foreground">Manage your defaults, integrations, and categories</p>
      </div>

      <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
        <Tabs defaultValue="general" className="gap-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" className="gap-1.5">
              <SettingsIcon className="size-4" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-1.5">
              <MessageCircle className="size-4" />
              <span>Telegram</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5">
              <Tags className="size-4" />
              <span>Categories</span>
            </TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="mt-6 space-y-4">
            <div className="space-y-1.5">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-timezone">Timezone</Label>
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
                Used to resolve dates like &quot;yesterday&quot; and to bucket daily pacing allowances.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-destructive">Delete account</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently deletes your account, cycles, transactions, categories, and Telegram links. This cannot be undone.
                  </p>
                </div>
              </div>

              {!confirmingDelete ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete account
                </Button>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <Label htmlFor="settings-delete-confirm" className="text-xs">
                    Type <span className="font-semibold text-foreground">{settings?.email}</span> to confirm
                  </Label>
                  <Input
                    id="settings-delete-confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={settings?.email ?? ""}
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={
                        deleteAccount.isPending ||
                        !settings?.email ||
                        deleteConfirm.trim().toLowerCase() !== settings.email.toLowerCase()
                      }
                      onClick={confirmDelete}
                    >
                      {deleteAccount.isPending ? "Deleting…" : "Permanently delete"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConfirmingDelete(false)
                        setDeleteConfirm("")
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Telegram */}
          <TabsContent value="telegram" className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-code">Connect Telegram Bot</Label>
              <p className="text-xs text-muted-foreground">
                {settings?.botUsername ? (
                  <>
                    Open{" "}
                    <a
                      href={`https://t.me/${settings.botUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      @{settings.botUsername}
                    </a>{" "}
                    in Telegram, send{" "}
                    <code className="rounded bg-muted px-1 py-0.5 tabular">/link</code>, then enter
                    the 6-digit code here.
                  </>
                ) : (
                  <>
                    Send <code className="rounded bg-muted px-1 py-0.5 tabular">/link</code> to the
                    bot, then enter the code here.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="settings-code"
                placeholder="Enter 6-digit code"
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
              <ul className="mt-3 flex flex-col gap-1.5">
                {links.map((link) => (
                  <li
                    key={link.chatId}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3.5 py-2.5"
                  >
                    <span className="truncate text-sm font-medium">
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
              <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center">
                <MessageCircle className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No Telegram accounts linked yet</p>
              </div>
            )}
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-cat">Categories</Label>
              <p className="text-xs text-muted-foreground">
                Custom categories used by the AI command parser and manual logs.
              </p>
            </div>

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
              <ul className="mt-3 flex flex-col gap-1.5">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-2 rounded-xl border bg-background px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 truncate text-sm">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          cat.type === "Income" ? "bg-income" : "bg-expense"
                        )}
                      />
                      <span className="truncate font-medium">{cat.name}</span>
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          cat.type === "Income" ? "text-income" : "text-expense"
                        )}
                      >
                        ({cat.type})
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCategory(cat.id)}
                      aria-label={`Delete ${cat.name}`}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center">
                <Tags className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default SettingsPanel
