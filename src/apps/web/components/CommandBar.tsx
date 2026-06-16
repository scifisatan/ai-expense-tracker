import { useState } from "react"
import { ArrowUp, Loader2, SlidersHorizontal, Sparkles } from "lucide-react"
import type { Category } from "@web/types"
import type { TransactionType } from "@/shared/types"
import { Button } from "@web/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@web/components/ui/tooltip"
import TransactionDialog from "./TransactionDialog"

type Props = {
  categories: Category[]
  currency: string
  onCreate: (input: {
    amount: number
    type: TransactionType
    categoryId?: number | null
    note?: string | null
  }) => Promise<boolean>
  onAddFromText: (text: string) => Promise<boolean>
}

// Natural-language first — type the way you'd tell a friend. Manual entry is one tap away.
const CommandBar = ({ categories, currency, onCreate, onAddFromText }: Props) => {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const send = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    const ok = await onAddFromText(value)
    setBusy(false)
    if (ok) setText("")
  }

  return (
    <>
      <div className="rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
        <div className="flex items-center gap-2">
          <Sparkles className="ml-2 size-4 shrink-0 text-primary" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Try “spent 12 on coffee” or “got 2000 salary”"
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground"
            aria-label="Add a transaction in natural language"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setManualOpen(true)}
                aria-label="Add manually"
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add manually</TooltipContent>
          </Tooltip>

          <Button
            type="button"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => void send()}
            disabled={!text.trim() || busy}
            aria-label="Add"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        Just type it in plain language — same magic as the Telegram bot.
      </p>

      <TransactionDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        mode="create"
        categories={categories}
        currency={currency}
        onCreate={onCreate}
      />
    </>
  )
}

export default CommandBar
