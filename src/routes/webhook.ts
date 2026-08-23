import { Router } from 'express';
import type { Request, Response } from 'express';
import { recoveryAgentApp } from '../services/agent/recoveryAgent';
import { prisma } from '../db';

const router = Router();

router.post('/razorpay', async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = (req.headers['x-razorpay-event-id'] as string) || 'evt_default';
    const { event, payload } = req.body;

    console.log(`[Webhook Received] Event: ${event}, Event ID: ${eventId}`);

    if (event === 'payment.failed') {
      const payment = payload?.payment?.entity || {};
      const paymentId = (payment.id as string) || `pay_${Date.now()}`;
      const orderId = (payment.order_id as string) || null;
      const customerEmail = (payment.email as string) || null;
      const customerContact = (payment.contact as string) || null;
      const amountInRupees = (payment.amount || 0) / 100;
      const failureReason = (payment.error_code || payment.error_description || 'PAYMENT_FAILED') as string;
      const customerMessage = (payment.error_description || 'My payment failed') as string;

      // 1. Save or update PaymentFailure in database
      const paymentFailure = await prisma.paymentFailure.upsert({
        where: { paymentId },
        update: {
          orderId,
          customerEmail,
          customerContact,
          amountInRupees,
          failureReason,
        },
        create: {
          paymentId,
          orderId,
          customerEmail,
          customerContact,
          amountInRupees,
          failureReason,
        },
      });

      // 2. Invoke recovery agent state graph
      const agentResult: any = await recoveryAgentApp.invoke({
        customerMessage,
        amountInRupees,
        failureReason,
        retryCount: 0,
        decision: null,
        validationError: null,
      });

      const decision = agentResult?.decision || {
        nextAction: 'SEND_LINK',
        discountBps: 0,
        promiseDate: null,
        customerFacingMessage: 'Here is your secure link to retry payment.',
        internalReasoning: 'Default fallback response',
      };

      // 3. Save RecoverySession in database
      const recoverySession = await prisma.recoverySession.create({
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

      res.status(200).json({
        success: true,
        eventId,
        paymentFailure,
        recoverySession,
        decision,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Event '${event}' acknowledged.`,
    });
  } catch (error: any) {
    console.error('[Webhook Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  }
});

export default router;
