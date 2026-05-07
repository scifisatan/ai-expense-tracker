import { useState, useMemo } from "react";
import { money } from "../helper";
import { Transaction } from "../types";
import { TransactionType } from "@/domain/ledger/types";

const EditableRow = ({
  tx,
  selected,
  onSelect,
  onSave,
  onDelete,
}: {
  tx: Transaction;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onSave: (patch: Partial<Transaction>) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(tx.type);
  const [amount, setAmount] = useState(tx.amount.toString());
  const [note, setNote] = useState(tx.note ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({ type, amount: Number(amount), note });
    setSaving(false);
    setEditing(false);
  };

  const dateStr = useMemo(() => {
    try {
      return new Date(tx.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
    } catch {
      return tx.createdAt;
    }
  }, [tx.createdAt]);

  if (!editing) {
    return (
      <tr>
        <td className="checkbox-cell">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        </td>
        <td className="td-id">#{tx.id}</td>
        <td>
          <span className={`badge badge-${tx.type.toLowerCase()}`}>
            <span className={`badge-dot bd-${tx.type.toLowerCase()}`} />
            {tx.type}
          </span>
        </td>
        <td>
          <span className={`amount-cell amount-${tx.type.toLowerCase()}`}>
            {tx.type === "Income" ? "+" : "−"} {money(tx.amount)}
          </span>
        </td>
        <td>
          <span className={tx.note ? "note-cell" : "note-empty"}>{tx.note || "no note"}</span>
        </td>
        <td className="date-cell">{dateStr}</td>
        <td style={{ display: "flex", gap: 4 }}>
          <button className="btn-edit" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className="btn-delete"
            onClick={() => {
              if (confirm("Delete this transaction?")) onDelete();
            }}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="edit-row">
      <td className="checkbox-cell"></td>
      <td className="td-id">#{tx.id}</td>
      <td>
        <select className="inline-select" value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
          <option value="Income">Income</option>
          <option value="Expense">Expense</option>
        </select>
      </td>
      <td>
        <input
          className="inline-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 120 }}
        />
      </td>
      <td>
        <input
          className="inline-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ minWidth: 140 }}
        />
      </td>
      <td className="date-cell">{dateStr}</td>
      <td style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button className="btn-save" onClick={save} disabled={saving}>
          {saving ? "…" : "Save"}
        </button>
        <button
          className="btn-cancel"
          onClick={() => {
            setEditing(false);
            setType(tx.type);
            setAmount(tx.amount.toString());
            setNote(tx.note ?? "");
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
};

export default EditableRow;
