export const MAX_DISCOUNT_BPS = 500; // 5% maximum discount allowed
export function checkCompliancePolicies(retryCount, maxRetries = 3, currentDate = new Date()) {
    // 1. Max Retry Ceiling Guard
    if (retryCount >= maxRetries) {
        return {
            allowed: false,
            reason: `Maximum retry ceiling (${maxRetries}) reached. Dunning aborted.`
        };
    }
    // 2. TRAI DND Compliance Guard (No messaging between 21:00 and 09:00 IST)
    // Convert UTC time to IST (UTC + 5:30)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(currentDate.getTime() + istOffsetMs);
    const hourIST = istTime.getUTCHours();
    if (hourIST >= 21 || hourIST < 9) {
        return {
            allowed: false,
            reason: `TRAI DND Window active (${hourIST}:00 IST). Messaging restricted between 21:00 and 09:00 IST.`
        };
    }
    return {
        allowed: true,
        reason: 'Compliance checks passed.'
    };
}
export function enforcePolicyGuard(decision) {
    const sanitized = { ...decision };
    // Hard clamp discount to maximum 500 bps (5%)
    if (sanitized.discountBps > MAX_DISCOUNT_BPS) {
        sanitized.discountBps = MAX_DISCOUNT_BPS;
        sanitized.internalReasoning += ` [POLICY_GUARD: Discount clamped to maximum ${MAX_DISCOUNT_BPS} bps]`;
    }
    if (sanitized.discountBps < 0) {
        sanitized.discountBps = 0;
    }
    // Ensure action is valid
    const allowedActions = ['SEND_LINK', 'SCHEDULE_P2P', 'APPLY_DISCOUNT', 'ESCALATE_HUMAN', 'ABORT'];
    if (!allowedActions.includes(sanitized.nextAction)) {
        sanitized.nextAction = 'SEND_LINK';
        sanitized.internalReasoning += ` [POLICY_GUARD: Unknown action coerced to SEND_LINK]`;
    }
    return sanitized;
}
//# sourceMappingURL=policyGuard.js.map