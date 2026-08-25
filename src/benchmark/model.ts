export interface FailureProfile {
    id: string;
    orderId: string;
    amountInRupees: number;
    failureCode: string;
    retryCount: number;
    hoursSinceFailure: number;
    withinTraiWindow: boolean;
    appliedDiscountBps: number;
}

export function computeRecoveryProbability(profile: FailureProfile): number {
    if (profile.failureCode === 'INVALID_VPA' || profile.retryCount >= 3) {
        return 0.0; // Terminal failure
    }

    let z = 0.35; // Base log-odds

    // Failure code weights
    if (profile.failureCode === 'GATEWAY_ERROR') z += 1.30;
    if (profile.failureCode === 'INSUFFICIENT_FUNDS') z -= 0.55;
    if (profile.failureCode === 'PAYMENT_CANCELLED_BY_USER') z += 0.40;

    // Incentives and decay
    z += (profile.appliedDiscountBps / 500) * 0.45;
    z -= profile.retryCount * 0.50;
    z -= (profile.hoursSinceFailure / 24) * 0.30;

    if (!profile.withinTraiWindow) {
        z -= 0.85; // Compliance window delay penalty
    }

    const prob = 1 / (1 + Math.exp(-z));
    return parseFloat(prob.toFixed(4));
}