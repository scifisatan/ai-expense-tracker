import { useMemo } from "react"
import { money, pct } from "../helper"
import { type SortKey } from "@web/types"
import EditableRow from "./EditableRow"
import { useTransaction } from "../hooks/useTransaction"
import { useTransactionFilter } from "../hooks/useTransactionFilter"
import { useTransactionSelection } from "../hooks/useTransactionSelection"

const Dashboard = ({ chatId, onLogout }: { chatId: number | null; onLogout: () => void }) => {
  const { transactions, summary, isLoading, status, updateTransaction, deleteTransactions } =
    useTransaction(() => clearSelection())

  const { search, setSearch, typeFilter, setTypeFilter, filtered, getSortThProps } =
    useTransactionFilter(transactions)

  const { selectedIds, allSelected, toggleSelect, toggleSelectAll, clearSelection } =
    useTransactionSelection(filtered.map((t) => t.id))

  const incomeCount = useMemo(
    () => transactions.filter((t) => t.type === "Income").length,
    [transactions]
  )
  const expenseCount = useMemo(
    () => transactions.filter((t) => t.type === "Expense").length,
    [transactions]
  )

  const avgTx = summary && summary.transactions > 0 ? summary.expense / summary.transactions : 0

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => {
    const { active, dir, onToggle } = getSortThProps(k)
    return (
      <th onClick={onToggle} className={active ? "active-sort" : ""}>
        {label}
        <span className="sort-arrow">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </th>
    )
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">💰 Budget Dashboard</span>
        <div className="topbar-right">
          {chatId && <span className="topbar-chatid">ID: {chatId}</span>}
          <button className="btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* ── Summary cards ── */}
        {summary && (
          <div className="summary-grid">
            <div className="metric-card income">
              <div className="metric-label">Total Income</div>
              <div className="metric-value income">{money(summary.income)}</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{ width: `${pct(summary.income, summary.income + summary.expense)}%` }}
                />
              </div>
            </div>
            <div className="metric-card expense">
              <div className="metric-label">Total Expense</div>
              <div className="metric-value expense">{money(summary.expense)}</div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill expense"
                  style={{ width: `${pct(summary.expense, summary.income + summary.expense)}%` }}
                />
              </div>
            </div>
            <div className="metric-card net">
              <div className="metric-label">Net Balance</div>
              <div className={`metric-value net ${summary.net >= 0 ? "pos" : "neg"}`}>
                {summary.net >= 0 ? "+" : "−"}
                {money(summary.net)}
              </div>
              <div className="metric-bar">
                <div
                  className="metric-bar-fill"
                  style={{
                    width: `${Math.min(100, pct(Math.abs(summary.net), summary.income))}%`,
                    background: summary.net >= 0 ? "var(--income)" : "var(--expense)"
                  }}
                />
              </div>
            </div>
            <div className="metric-card txcount">
              <div className="metric-label">Transactions</div>
              <div className="metric-value" style={{ color: "var(--amber)" }}>
                {summary.transactions}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink3)" }}>
                {incomeCount} income · {expenseCount} expenses
              </div>
            </div>
          </div>
        )}

        {/* ── Insight chips ── */}
        {summary && (
          <div className="insight-strip">
            <div className="insight-chip">
              <span className="dot dot-income" />
              Savings rate: {pct(summary.net, summary.income)}%
            </div>
            <div className="insight-chip">
              <span className="dot dot-expense" />
              Spend ratio: {pct(summary.expense, summary.income)}%
            </div>
            <div className="insight-chip">
              <span className="dot dot-accent" />
              Avg expense: {money(avgTx)}
            </div>
            <div className="insight-chip">
              <span className="dot dot-amber" />
              Showing last {transactions.length} transactions
            </div>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="table-card">
          <div className="table-header-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="table-title">Transactions</span>
              {selectedIds.size > 0 && (
                <button
                  className="btn-delete-bulk"
                  onClick={() => {
                    if (confirm(`Delete ${selectedIds.size} selected transactions?`))
                      deleteTransactions(Array.from(selectedIds))
                  }}
                >
                  Delete ({selectedIds.size})
                </button>
              )}
            </div>
            <div className="filter-bar" style={{ margin: 0 }}>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  placeholder="Search notes, amounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {(["All", "Income", "Expense"] as const).map((t) => (
                <button
                  key={t}
                  className={`filter-tag ${typeFilter === t ? (t === "Income" ? "active-income" : t === "Expense" ? "active-expense" : "active-income") : "inactive"}`}
                  style={
                    typeFilter === t && t === "All"
                      ? { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }
                      : {}
                  }
                  onClick={() => setTypeFilter(t)}
                >
                  {t !== "All" && (
                    <span
                      className={`badge-dot bd-${t.toLowerCase()}`}
                      style={{ width: 6, height: 6, borderRadius: "50%", display: "inline-block" }}
                    />
                  )}
                  {t}
                </button>
              ))}
              <span className="filter-count">{filtered.length} rows</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  <SortTh k="id" label="ID" />
                  <SortTh k="type" label="Type" />
                  <SortTh k="amount" label="Amount" />
                  <th>Note</th>
                  <SortTh k="createdAt" label="Date" />
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">No transactions match your filters.</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((tx) => (
                    <EditableRow
                      key={tx.id}
                      tx={tx}
                      selected={selectedIds.has(tx.id)}
                      onSelect={(checked) => toggleSelect(tx.id, checked)}
                      onSave={(patch) => updateTransaction(tx, patch)}
                      onDelete={() => deleteTransactions([tx.id])}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {status && <div className="global-status">{status}</div>}
    </div>
  )
}

export default Dashboard
