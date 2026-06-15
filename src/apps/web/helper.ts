import { formatMoney, fromMinor } from "@/shared/money"

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

export { formatMoney, fromMinor, pct }
