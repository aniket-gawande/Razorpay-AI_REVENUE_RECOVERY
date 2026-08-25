import { FailureProfile, computeRecoveryProbability } from './model';
import { calculateUnitEconomics } from '../services/unitEconomics';
import { triagePaymentFailure } from '../services/triageEngine';

export function executeBenchmark(batchSize: number = 100) {
  const failureCodes = [
    'GATEWAY_ERROR',
    'INSUFFICIENT_FUNDS',
    'PAYMENT_CANCELLED_BY_USER',
    'INVALID_VPA'
  ];

  let totalAtRisk = 0;
  let totalRecovered = 0;
  let totalChannelCost = 0;
  let blockedByEconCount = 0;
  const itemizedResults = [];

  for (let i = 1; i <= batchSize; i++) {
    // Generate log-normal transaction values (₹150 to ₹12,000)
    const amount = Math.round(Math.exp(5.2 + Math.random() * 2.8));
    const code = failureCodes[Math.floor(Math.random() * failureCodes.length)];
    const retryCount = Math.floor(Math.random() * 3);
    const withinTrai = Math.random() > 0.15;
    const discountBps = code === 'PAYMENT_CANCELLED_BY_USER' ? 300 : 0;

    const profile: FailureProfile = {
      id: `SIM-${i.toString().padStart(3, '0')}`,
      orderId: `order_sim_${i}`,
      amountInRupees: amount,
      failureCode: code,
      retryCount,
      hoursSinceFailure: Math.random() * 36,
      withinTraiWindow: withinTrai,
      appliedDiscountBps: discountBps
    };

    const triage = triagePaymentFailure(code, amount);
    const prob = computeRecoveryProbability(profile);
    const econ = calculateUnitEconomics(amount, discountBps);

    totalAtRisk += amount;

    // Channel cost estimation: ₹5 per recovery SMS/WhatsApp message
    const channelCost = 5.0;

    if (!econ.isViable || prob < 0.15) {
      blockedByEconCount++;
      itemizedResults.push({
        ...profile,
        status: 'DROPPED_NEGATIVE_UNIT_ECONOMICS',
        cost: 0,
        recovered: 0
      });
      continue;
    }

    totalChannelCost += channelCost;
    const isRecovered = prob >= 0.45;
    const recoveredVal = isRecovered ? amount : 0;
    totalRecovered += recoveredVal;

    itemizedResults.push({
      ...profile,
      probability: prob,
      status: isRecovered ? 'RECOVERED' : 'EXHAUSTED',
      cost: channelCost,
      recovered: recoveredVal
    });
  }

  const recoveryRate = ((totalRecovered / (totalAtRisk || 1)) * 100).toFixed(2);
  const netGTV = totalRecovered - totalChannelCost;

  return {
    summary: {
      batchSize,
      totalRevenueAtRisk: totalAtRisk,
      totalRevenueRecovered: totalRecovered,
      recoveryRatePercent: parseFloat(recoveryRate),
      totalChannelCost: parseFloat(totalChannelCost.toFixed(2)),
      netRevenueWonBack: parseFloat(netGTV.toFixed(2)),
      blockedByUnitEconomics: blockedByEconCount
    },
    sampleRecords: itemizedResults.slice(0, 10)
  };
}
