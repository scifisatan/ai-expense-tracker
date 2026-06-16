import { useState, useCallback } from "react"
import { trpc } from "@web/trpc"
import { type Transaction, type TxUpdatePatch } from "@web/types"
import type { TransactionType } from "@/shared/types"

export function useTransaction(onMutationSuccess?: () => void) {
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

  const [status, setStatus] = useState("")

  const transactions: Transaction[] = txData?.items ?? []
  const categories = categoriesData?.items ?? []

  const flash = (msg: string, ms = 2500) => {
    setStatus(msg)
    setTimeout(() => setStatus(""), ms)
  }

  const loadData = useCallback(async () => {
    await Promise.all([refetchTx(), refetchSum(), refetchCategories()])
    onMutationSuccess?.()
  }, [refetchTx, refetchSum, refetchCategories, onMutationSuccess])

  const createTransaction = async (input: {
    amount: number
    type: TransactionType
    categoryId?: number | null
    note?: string | null
    occurredAt?: string
  }) => {
    try {
      await createMutation.mutateAsync(input)
      flash("Added ✓")
      await loadData()
      return true
    } catch {
      flash("Failed to add.", 3000)
      return false
    }
  }

  const addFromText = async (text: string) => {
    try {
      const result = await ingestMutation.mutateAsync({ text })
      if (result.reason === "RATE_LIMITED") {
        flash("Daily AI limit reached — try again tomorrow or add entries manually.", 4000)
        return false
      }
      if (!result.items.length) {
        flash("No transactions found in that text.", 3000)
        return false
      }
      flash(`Added ${result.items.length} transaction(s) ✓`)
      await loadData()
      return true
    } catch {
      flash("AI couldn't process that right now — please try again.", 3500)
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
        note: patch.note === undefined ? undefined : patch.note
      })
      flash("Saved ✓")
      await loadData()
    } catch {
      flash("Failed to update.", 3000)
    }
  }

  const deleteTransactions = async (ids: number[]) => {
    try {
      await deleteMutation.mutateAsync({ ids })
      flash(`Deleted ${ids.length} transaction(s) ✓`)
      await loadData()
    } catch {
      flash("Failed to delete.", 3000)
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
