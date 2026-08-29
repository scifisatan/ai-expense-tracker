import { useState, useCallback } from "react"
import { trpc } from "@web/trpc"
import { type Transaction, type TxUpdatePatch } from "@web/types"
import type { TransactionType } from "@/shared/types"

export function useTransaction(onMutationSuccess?: () => void) {
  const utils = trpc.useUtils()
  const {
    data: txData,
    isLoading: isTxLoading,
    refetch: refetchTx
  } = trpc.transactions.list.useQuery({ limit: 200 })
  const {
    data: summary,
    isLoading: isSumLoading,
    refetch: refetchSum
  } = trpc.insights.summary.useQuery()
  const { data: categoriesData, refetch: refetchCategories } = trpc.categories.list.useQuery()

  const createMutation = trpc.transactions.create.useMutation()
  const updateMutation = trpc.transactions.update.useMutation()
  const deleteMutation = trpc.transactions.delete.useMutation()
  const ingestMutation = trpc.ledger.ingestText.useMutation()

  // Structured so consumers can pick the right toast variant instead of
  // guessing success/failure from the message text.
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  const transactions: Transaction[] = txData?.items ?? []
  const categories = categoriesData?.items ?? []

  const flash = (kind: "success" | "error", text: string, ms = 2500) => {
    setStatus({ kind, text })
    setTimeout(() => setStatus(null), ms)
  }

  const loadData = useCallback(async () => {
    // cycles.current derives today's allowance/spend from the same
    // transactions rows, but lives in a separate query (usePacer) — a plain
    // transaction mutation never touches it unless we invalidate explicitly.
    await Promise.all([
      refetchTx(),
      refetchSum(),
      refetchCategories(),
      utils.cycles.current.invalidate()
    ])
    onMutationSuccess?.()
  }, [refetchTx, refetchSum, refetchCategories, utils, onMutationSuccess])

  const createTransaction = async (input: {
    amount: number
    type: TransactionType
    categoryId?: number | null
    note?: string | null
    occurredAt?: string
  }) => {
    try {
      await createMutation.mutateAsync(input)
      flash("success", "Added ✓")
      await loadData()
      return true
    } catch {
      flash("error", "Failed to add.", 3000)
      return false
    }
  }

  const addFromText = async (text: string) => {
    try {
      const result = await ingestMutation.mutateAsync({ text })
      if (result.reason === "RATE_LIMITED") {
        flash("error", "Daily AI limit reached — try again tomorrow or add entries manually.", 4000)
        return false
      }
      if (result.reason === "AI_ERROR") {
        flash("error", "AI couldn't process that right now — please try again.", 3500)
        return false
      }
      if (!result.items.length) {
        flash("error", "No transactions found in that text.", 3000)
        return false
      }
      flash("success", `Added ${result.items.length} transaction(s) ✓`)
      await loadData()
      return true
    } catch {
      flash("error", "AI couldn't process that right now — please try again.", 3500)
      return false
    }
  }

  const updateTransaction = async (tx: Transaction, patch: TxUpdatePatch) => {
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
        amount: patch.amount,
        type: patch.type,
        categoryId: patch.categoryId,
        note: patch.note === undefined ? undefined : patch.note,
        occurredAt: patch.occurredAt
      })
      flash("success", "Saved ✓")
      await loadData()
    } catch {
      flash("error", "Failed to update.", 3000)
    }
  }

  const deleteTransactions = async (ids: number[]) => {
    try {
      await deleteMutation.mutateAsync({ ids })
      flash("success", `Deleted ${ids.length} transaction(s) ✓`)
      await loadData()
    } catch {
      flash("error", "Failed to delete.", 3000)
    }
  }

  return {
    transactions,
    categories,
    summary,
    isLoading: isTxLoading || isSumLoading,
    status,
    createTransaction,
    addFromText,
    updateTransaction,
    deleteTransactions
  }
}
