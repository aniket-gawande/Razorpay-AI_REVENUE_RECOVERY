import { z } from 'zod';

export const AgentDecisionSchema = z.object({
  nextAction: z.enum(['SEND_LINK', 'SCHEDULE_P2P', 'APPLY_DISCOUNT', 'ESCALATE_HUMAN', 'ABORT']),
  discountBps: z.number().min(0).max(500),
  promiseDate: z.string().nullable(),
  customerFacingMessage: z.string(),
  internalReasoning: z.string()
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
