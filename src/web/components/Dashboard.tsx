import { useState, useCallback, useMemo } from "react";
import { money, pct } from "../helper";
import { type SortKey, type SortDir, type Transaction } from "../types";
import EditableRow from "./EditableRow";
import { trpc } from "../trpc";

const Dashboard = ({ chatId, onLogout }: { chatId: number | null; onLogout: () => void }) => {
  const { data: txData, isLoading: isTxLoading, refetch: refetchTx } = trpc.transactions.list.useQuery({ limit: 200 });
  const { data: summary, isLoading: isSumLoading, refetch: refetchSum } = trpc.insights.summary.useQuery();

  const transactions = (txData?.items ?? []) as Transaction[];

  const updateMutation = trpc.transactions.update.useMutation();
  const deleteMutation = trpc.transactions.delete.useMutation();

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Income" | "Expense">("All");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    await Promise.all([refetchTx(), refetchSum()]);
    setSelectedIds(new Set());
  }, [refetchTx, refetchSum]);

  const updateTransaction = async (tx: Transaction, patch: Partial<Transaction>) => {
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
        amount: patch.amount,
        type: patch.type,
        note: patch.note === undefined ? undefined : patch.note
      });
      setStatus("Saved ✓");
      setTimeout(() => setStatus(""), 2500);
      await loadData();
    } catch (e) {
      setStatus("Failed to update.");
      setTimeout(() => setStatus(""), 3000);
    }
  };

  const deleteTransactions = async (ids: number[]) => {
    try {
      await deleteMutation.mutateAsync({ ids });
      setStatus(`Deleted ${ids.length} transaction(s) ✓`);
      setTimeout(() => setStatus(""), 2500);
      await loadData();
    } catch (e) {
      setStatus("Failed to delete.");
      setTimeout(() => setStatus(""), 3000);
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: number, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (typeFilter !== "All") list = list.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.note?.toLowerCase().includes(q) ||
          String(t.amount).includes(q) ||
          String(t.id).includes(q),
      );
    }
    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? "";
      let vb: string | number = b[sortKey] ?? "";
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [transactions, typeFilter, search, sortKey, sortDir]);

  const incomeCount = transactions.filter((t) => t.type === "Income").length;
  const expenseCount = transactions.filter((t) => t.type === "Expense").length;
  const avgTx = summary && summary.transactions > 0 ? summary.expense / summary.transactions : 0;

  const SortTh = ({ k, label }: { k: SortKey; label: string }) => (
    <th onClick={() => toggleSort(k)} className={sortKey === k ? "active-sort" : ""}>
      {label}
      <span className="sort-arrow">{sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );

  if (isTxLoading || isSumLoading) return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;

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
                    background: summary.net >= 0 ? "var(--income)" : "var(--expense)",
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
                      deleteTransactions(Array.from(selectedIds));
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
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
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
  );
};

export default Dashboard;
