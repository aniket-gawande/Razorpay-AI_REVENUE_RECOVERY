import { Router } from 'express';
import type { Request, Response } from 'express';
import { recoveryAgentApp } from '../services/agent/recoveryAgent';
import { prisma } from '../db';

const router = Router();

// POST /api/recovery/chat - Chat with Recovery Agent for customer messages
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentId, message, amount, failureReason } = req.body;

    const customerMessage = message || 'Can you help me complete my payment?';

    // Fetch existing payment failure from DB if paymentId is passed
    let paymentFailure = paymentId
      ? await prisma.paymentFailure.findUnique({ where: { paymentId } })
      : null;

    const amountInRupees = amount || paymentFailure?.amountInRupees || 2500;
    const reason = failureReason || paymentFailure?.failureReason || 'PAYMENT_FAILED';

    // Run recovery agent AI
    const agentResult: any = await recoveryAgentApp.invoke({
      customerMessage,
      amountInRupees,
      failureReason: reason,
      retryCount: 0,
      decision: null,
      validationError: null,
    });

    const decision = agentResult?.decision || {
      nextAction: 'SEND_LINK',
      discountBps: 0,
      promiseDate: null,
      customerFacingMessage: 'Here is your link to retry the payment.',
      internalReasoning: 'Fallback response',
    };

    let sessionRecord = null;
    if (paymentFailure) {
      sessionRecord = await prisma.recoverySession.create({
        data: {
          paymentFailureId: paymentFailure.id,
          customerMessage,
          nextAction: decision.nextAction,
          discountBps: decision.discountBps,
          promiseDate: decision.promiseDate,
          customerFacingMessage: decision.customerFacingMessage,
          internalReasoning: decision.internalReasoning,
        },
      });
    }

    res.status(200).json({
      success: true,
      decision,
      savedToDatabase: !!sessionRecord,
      session: sessionRecord,
    });
  } catch (error: any) {
    console.error('[Recovery Chat Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat',
    });
  }
});

// GET /api/recovery/sessions - List all recovery sessions stored in DB
router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.recoverySession.findMany({
      include: { paymentFailure: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, count: sessions.length, sessions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/recovery/failures - List all payment failures stored in DB
router.get('/failures', async (req: Request, res: Response): Promise<void> => {
  try {
    const failures = await prisma.paymentFailure.findMany({
      include: { recoverySessions: true },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, count: failures.length, failures });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
