import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { recoveryAgentApp } from '../services/agent/recoveryAgent';
import { createTrackedPaymentLink } from '../services/razorpay';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  const { transactionId, userMessage } = req.body;

  try {
    const tx = await prisma.transactionFailure.findUnique({
      where: { id: transactionId },
      include: { auditLogs: true }
    });

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Pass prior context and user message to LangGraph
    const state = await recoveryAgentApp.invoke({
      customerMessage: userMessage,
      amountInRupees: tx.amountInPaisa / 100,
      failureReason: tx.failureCode,
      retryCount: tx.retryCount,
      decision: null,
      validationError: null
    });

    const decision = state.decision!;
    let paymentLink = null;

    if (decision.nextAction === 'SEND_LINK' || decision.nextAction === 'APPLY_DISCOUNT') {
      paymentLink = await createTrackedPaymentLink({
        amountInRupees: tx.amountInPaisa / 100,
        discountBps: decision.discountBps,
        phone: tx.customerPhone,
        email: tx.customerEmail,
        orderId: tx.razorpayOrderId
      });
    }

    // Persist multi-turn updates & P2P promises
    await prisma.transactionFailure.update({
      where: { id: tx.id },
      data: {
        discountAppliedBps: decision.discountBps,
        promiseToPayDate: decision.promiseDate ? new Date(decision.promiseDate) : tx.promiseToPayDate,
        recoveryStatus: decision.nextAction === 'SCHEDULE_P2P' ? 'AWAITING_P2P' : tx.recoveryStatus
      }
    });

    await prisma.auditLog.create({
      data: {
        transactionFailureId: tx.id,
        nodeName: 'LANGGRAPH_RECOVERY_AGENT',
        actionTaken: decision.nextAction,
        reasoning: `User: "${userMessage}" | Decision: ${decision.internalReasoning} | Response: "${decision.customerFacingMessage}"`,
        costDelta: 0.10
      }
    });

    return res.status(200).json({
      decision,
      paymentLink
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/transactions', async (_req: Request, res: Response) => {
  const records = await prisma.transactionFailure.findMany({
    include: { auditLogs: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
  return res.status(200).json(records);
});

export default router;