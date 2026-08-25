import { AgentDecision } from './agent/schemas';

export const MAX_DISCOUNT_BPS = 500; // 5% maximum discount allowed

export function enforcePolicyGuard(decision: AgentDecision): AgentDecision {
  const sanitized: AgentDecision = { ...decision };

  // Hard clamp discount
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
