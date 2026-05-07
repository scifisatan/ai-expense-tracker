import { useState, useCallback } from "react"
import { trpc } from "@web/trpc"
import { type Transaction } from "@web/types"

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

  const updateMutation = trpc.transactions.update.useMutation()
  const deleteMutation = trpc.transactions.delete.useMutation()

  const [status, setStatus] = useState("")

  const transactions: Transaction[] = txData?.items ?? []

  const loadData = useCallback(async () => {
    await Promise.all([refetchTx(), refetchSum()])
    onMutationSuccess?.()
  }, [refetchTx, refetchSum, onMutationSuccess])

  const updateTransaction = async (tx: Transaction, patch: Partial<Transaction>) => {
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
        amount: patch.amount,
        type: patch.type,
        note: patch.note === undefined ? undefined : patch.note
      })
      setStatus("Saved ✓")
      setTimeout(() => setStatus(""), 2500)
      await loadData()
    } catch {
      setStatus("Failed to update.")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  const deleteTransactions = async (ids: number[]) => {
    try {
      await deleteMutation.mutateAsync({ ids })
      setStatus(`Deleted ${ids.length} transaction(s) ✓`)
      setTimeout(() => setStatus(""), 2500)
      await loadData()
    } catch {
      setStatus("Failed to delete.")
      setTimeout(() => setStatus(""), 3000)
    }
  }

  return {
    transactions,
    summary,
    isLoading: isTxLoading || isSumLoading,
    status,
    updateTransaction,
    deleteTransactions
  }
}
