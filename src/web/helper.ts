const money = (v: number) => `Rs. ${Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (part: number, total: number) => total ? Math.round((part / total) * 100) : 0;

export { money, pct }