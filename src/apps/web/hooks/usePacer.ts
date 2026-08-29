import { useState } from "react"
import { trpc } from "@web/trpc"
import type { AllocationKind } from "@/shared/types"

export function usePacer() {
  const utils = trpc.useUtils()
  const { data: snapshot, isLoading, refetch } = trpc.cycles.current.useQuery()
  const { data: lastCompleted, refetch: refetchLastCompleted } = trpc.cycles.lastCompleted.useQuery()
  const createMutation = trpc.cycles.create.useMutation()
  const updateMutation = trpc.cycles.update.useMutation()
  const closeMutation = trpc.cycles.close.useMutation()
  const depositMutation = trpc.cycles.depositSavings.useMutation()

  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  const flash = (kind: "success" | "error", text: string, ms = 2500) => {
    setStatus({ kind, text })
    setTimeout(() => setStatus(null), ms)
  }

  const startCycle = async (input: {
    startDate: string
    endDate: string
    gross: number
    sweepPct: number
    allocations: { kind: AllocationKind; label: string; amount: number }[]
  }) => {
    try {
      await createMutation.mutateAsync(input)
      flash("success", "Cycle started ✓")
      await Promise.all([
        refetch(),
        refetchLastCompleted(),
        utils.cycles.review.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.list.invalidate()
      ])
      return true
    } catch {
      flash("error", "Failed to start the cycle.", 3000)
      return false
    }
  }

  const updateCycle = async (input: {
    id: number
    gross?: number
    sweepPct?: number
    allocations?: { kind: AllocationKind; label: string; amount: number }[]
  }) => {
    try {
      await updateMutation.mutateAsync(input)
      flash("success", "Allocations updated ✓")
      await Promise.all([
        refetch(),
        refetchLastCompleted(),
        utils.cycles.review.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.list.invalidate()
      ])
      return true
    } catch {
      flash("error", "Failed to update allocations.", 3000)
      return false
    }
  }

  const closeCycle = async (id: number) => {
    try {
      await closeMutation.mutateAsync({ id })
      flash("success", "Cycle closed ✓")
      await Promise.all([refetch(), refetchLastCompleted(), utils.cycles.review.invalidate()])
      return true
    } catch {
      flash("error", "Failed to close the cycle.", 3000)
      return false
    }
  }

  const depositSavings = async (input: { amount: number; note?: string }) => {
    try {
      await depositMutation.mutateAsync(input)
      flash("success", "Deposited to Savings Vault ✓")
      await Promise.all([
        refetch(),
        refetchLastCompleted(),
        utils.cycles.review.invalidate(),
        utils.transactions.summary.invalidate(),
        utils.transactions.list.invalidate()
      ])
      return true
    } catch {
      flash("error", "Failed to deposit into Savings.", 3000)
      return false
    }
  }

  return {
    snapshot,
    lastCompleted,
    isLoading,
    status,
    startCycle,
    updateCycle,
    closeCycle,
    depositSavings,
    refetch
  }
}
