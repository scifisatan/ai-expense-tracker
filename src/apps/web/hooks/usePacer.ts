import { useState } from "react"
import { trpc } from "@web/trpc"
import type { AllocationKind } from "@/shared/types"

export function usePacer() {
  const { data: snapshot, isLoading, refetch } = trpc.cycles.current.useQuery()
  const createMutation = trpc.cycles.create.useMutation()
  const closeMutation = trpc.cycles.close.useMutation()

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
      await refetch()
      return true
    } catch {
      flash("error", "Failed to start the cycle.", 3000)
      return false
    }
  }

  const closeCycle = async (id: number) => {
    try {
      await closeMutation.mutateAsync({ id })
      flash("success", "Cycle closed ✓")
      await refetch()
    } catch {
      flash("error", "Failed to close the cycle.", 3000)
    }
  }

  return {
    snapshot,
    isLoading,
    status,
    startCycle,
    closeCycle
  }
}
