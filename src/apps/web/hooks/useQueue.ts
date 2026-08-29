import { useState } from "react"
import { trpc } from "@web/trpc"
import type { QueueKind } from "@web/types"

export function useQueue(kind: QueueKind) {
  const utils = trpc.useUtils()
  const { data, isLoading, refetch } = trpc.queue.list.useQuery({ kind })
  const createMutation = trpc.queue.create.useMutation()
  const reorderMutation = trpc.queue.reorder.useMutation()
  const purchaseMutation = trpc.queue.purchase.useMutation()
  const removeMutation = trpc.queue.remove.useMutation()

  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  const flash = (statusKind: "success" | "error", text: string, ms = 2500) => {
    setStatus({ kind: statusKind, text })
    setTimeout(() => setStatus(null), ms)
  }

  const items = data?.items ?? []

  // cycles.current's nearestQueueItem (and, after a purchase, its fund
  // balances) derive from this same queue — refresh both together or
  // TodayCard silently goes stale.
  const refreshAll = () => Promise.all([refetch(), utils.cycles.current.invalidate()])

  const addItem = async (input: {
    title: string
    price: number
    coolingDays?: number
    deadline?: string
  }) => {
    try {
      await createMutation.mutateAsync({ kind, ...input })
      flash("success", "Added to queue ✓")
      await refreshAll()
      return true
    } catch {
      flash("error", "Failed to add.", 3000)
      return false
    }
  }

  const reorder = async (id: number, afterId: number | null) => {
    try {
      await reorderMutation.mutateAsync({ id, afterId })
      await refreshAll()
    } catch {
      flash("error", "Failed to reorder.", 3000)
    }
  }

  // Reject reasons ("COOLING" / "UNDERFUNDED") arrive as the tRPC error's
  // message, set server-side in routes/queue.ts's purchase procedure.
  const purchase = async (id: number) => {
    try {
      await purchaseMutation.mutateAsync({ id })
      flash("success", "Purchased ✓")
      await refreshAll()
      return true
    } catch (error) {
      const reason = error instanceof Error ? error.message : ""
      const text =
        reason === "COOLING"
          ? "Still in its cooling-off period."
          : reason === "UNDERFUNDED"
            ? "Not enough in the fund yet."
            : "Failed to purchase."
      flash("error", text, 3000)
      return false
    }
  }

  const removeItem = async (id: number) => {
    try {
      await removeMutation.mutateAsync({ id })
      flash("success", "Removed ✓")
      await refreshAll()
    } catch {
      flash("error", "Failed to remove.", 3000)
    }
  }

  return {
    items,
    isLoading,
    status,
    addItem,
    reorder,
    purchase,
    removeItem
  }
}
