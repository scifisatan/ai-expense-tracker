import { useState } from "react"

export function useTransactionSelection(filteredIds: number[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredIds) : new Set())
  }

  const clearSelection = () => setSelectedIds(new Set())

  const allSelected = filteredIds.length > 0 && selectedIds.size === filteredIds.length

  return {
    selectedIds,
    allSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection
  }
}
