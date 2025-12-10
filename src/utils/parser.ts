export const parseBalance = (text: string): number | null => {
  const cleaned = text.trim();

  // Allow optional leading minus sign before digits/commas.
  const match = cleaned.match(/remaining\s*balance[^\d-]*(-?[\d,]+)/i);
  if (match?.[1]) return Number(match[1].replace(/,/g, ''));

  const matchRs = cleaned.match(/rs\.?\s*(-?[\d,]+)/i);
  if (matchRs?.[1]) return Number(matchRs[1].replace(/,/g, ''));

  return null;
};
