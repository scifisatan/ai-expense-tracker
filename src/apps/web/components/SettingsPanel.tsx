import { useState } from "react"
import { toast } from "sonner"
import {
  MessageCircle,
  Settings as SettingsIcon,
  Tags,
  Trash2,
} from "lucide-react"
import { trpc } from "@web/trpc"
import type { TransactionType } from "@/shared/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@web/components/ui/dialog"
import { Button } from "@web/components/ui/button"
import { Input } from "@web/components/ui/input"
import { Label } from "@web/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@web/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@web/components/ui/select"
import { cn } from "@web/lib/utils"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "NPR", "JPY", "AUD", "CAD"]

const SettingsPanel = ({ onClose }: { onClose: () => void }) => {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.settings.get.useQuery()
  const linksQuery = trpc.telegram.listLinks.useQuery()
  const categoriesQuery = trpc.categories.list.useQuery()

  const setCurrency = trpc.settings.setDefaultCurrency.useMutation()
  const confirmLink = trpc.telegram.confirmLink.useMutation()
  const unlink = trpc.telegram.unlink.useMutation()
  const createCategory = trpc.categories.create.useMutation()
  const deleteCategory = trpc.categories.delete.useMutation()

  const [code, setCode] = useState("")
  const [newCatName, setNewCatName] = useState("")
  const [newCatType, setNewCatType] = useState<TransactionType>("Expense")

  const saveCurrency = async (currency: string) => {
    await setCurrency.mutateAsync({ currency })
    await settingsQuery.refetch()
    toast.success("Default currency updated")
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
        e instanceof Error
          ? e.message
          : "Couldn't connect — check the code and try again."
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

  const settings = settingsQuery.data
  const categories = categoriesQuery.data?.items ?? []
  const links = linksQuery.data?.items ?? []

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
          <DialogDescription>
            Manage your defaults, integrations, and categories.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="gap-0 px-6 py-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">
              <SettingsIcon />
              <span className="hidden sm:inline">General</span>
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
          <TabsContent
            value="general"
            className="mt-6 flex flex-col gap-2"
          >
            <Label htmlFor="settings-currency">Default currency</Label>
            <Select
              value={settings?.defaultCurrency ?? "USD"}
              onValueChange={saveCurrency}
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
              Used as the default for new transactions.
            </p>
          </TabsContent>


          {/* Telegram */}
          <TabsContent
            value="telegram"
            className="mt-6 flex flex-col gap-2"
          >
            <Label htmlFor="settings-code">Connect Telegram</Label>
            <p className="text-xs text-muted-foreground">
              Send{" "}
              <code className="rounded bg-muted px-1 py-0.5 tabular">/link</code>{" "}
              to the bot, then enter the code it gives you.
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
              <Button
                onClick={submitCode}
                disabled={!code.trim() || confirmLink.isPending}
              >
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(link.chatId)}
                    >
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-2 rounded-md border border-dashed px-6 py-8 text-center">
                <MessageCircle className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No chats connected yet
                </p>
              </div>
            )}
          </TabsContent>

          {/* Categories */}
          <TabsContent
            value="categories"
            className="mt-6 flex flex-col gap-2"
          >
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
                          cat.type === "Income"
                            ? "bg-income"
                            : "bg-expense"
                        )}
                      />
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={cn(
                          "text-xs",
                          cat.type === "Income"
                            ? "text-income"
                            : "text-expense"
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
