import { useState, useMemo } from "react"
import { type SortKey, type SortDir, type Transaction } from "@web/types"

export function useTransactionFilter(transactions: Transaction[]) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"All" | "Income" | "Expense">("All")
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const getSortThProps = (key: SortKey) => ({
    active: sortKey === key,
    dir: sortDir,
    onToggle: () => toggleSort(key)
  })

  const filtered = useMemo(() => {
    let list = [...transactions]

    if (typeFilter !== "All") list = list.filter((t) => t.type === typeFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.note?.toLowerCase().includes(q) ||
          String(t.amount).includes(q) ||
          String(t.id).includes(q)
      )
    }

    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? ""
      let vb: string | number = b[sortKey] ?? ""
      if (typeof va === "string") va = va.toLowerCase()
      if (typeof vb === "string") vb = vb.toLowerCase()
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return list
  }, [transactions, typeFilter, search, sortKey, sortDir])

  return {
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    filtered,
    getSortThProps
  }
}
