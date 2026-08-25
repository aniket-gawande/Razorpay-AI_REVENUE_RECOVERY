export interface EconomicsAnalysis {
  originalAmount: number;
  discountBps: number;
  discountAmount: number;
  netRecoverableAmount: number;
  marginPercentage: number;
  isViable: boolean;
}

export function calculateUnitEconomics(amountInRupees: number, discountBps: number): EconomicsAnalysis {
  const safeDiscountBps = Math.min(Math.max(discountBps, 0), 500); // 0-500 bps (0%-5%)
  const discountRatio = safeDiscountBps / 10000;
  const discountAmount = amountInRupees * discountRatio;
  const netRecoverableAmount = amountInRupees - discountAmount;
  
  // Assume baseline 30% gross margin on recovery
  const grossMargin = 0.30;
  const netMargin = (netRecoverableAmount * grossMargin) / (amountInRupees || 1);

  return {
    originalAmount: amountInRupees,
    discountBps: safeDiscountBps,
    discountAmount: Math.round(discountAmount * 100) / 100,
    netRecoverableAmount: Math.round(netRecoverableAmount * 100) / 100,
    marginPercentage: Math.round(netMargin * 10000) / 100,
    isViable: netRecoverableAmount > 0 && netMargin > 0.05,
  };
}
