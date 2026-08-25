import { Router } from 'express';
import { recoveryAgentApp } from '../services/agent/recoveryAgent';
import { enforcePolicyGuard } from '../services/policyGuard';
import { calculateUnitEconomics } from '../services/unitEconomics';
import { createPaymentLink } from '../services/razorpay';
import { prisma } from '../db';
const router = Router();
// POST /api/recovery/chat - Chat with Recovery Agent for customer messages
router.post('/chat', async (req, res) => {
    try {
        const { paymentId, message, amount, failureReason } = req.body;
        const customerMessage = message || 'Can you help me complete my payment?';
        // Fetch existing payment failure from DB if paymentId is passed safely
        let paymentFailure = null;
        if (paymentId) {
            try {
                paymentFailure = await prisma.paymentFailure.findUnique({ where: { paymentId } });
            }
            catch (dbErr) {
                console.warn('[DB Warning] PaymentFailure fetch skipped:', dbErr.message || dbErr);
            }
        }
        const amountInRupees = amount || paymentFailure?.amountInRupees || 2500;
        const reason = failureReason || paymentFailure?.failureReason || 'PAYMENT_FAILED';
        // Run recovery agent AI
        const agentResult = await recoveryAgentApp.invoke({
            customerMessage,
            amountInRupees,
            failureReason: reason,
            retryCount: 0,
            decision: null,
            validationError: null,
        });
        const rawDecision = agentResult?.decision || {
            nextAction: 'SEND_LINK',
            discountBps: 0,
            promiseDate: null,
            customerFacingMessage: 'Here is your link to retry the payment.',
            internalReasoning: 'Fallback response',
        };
        // Policy Guard & Unit Economics Enforcement
        const decision = enforcePolicyGuard(rawDecision);
        const economics = calculateUnitEconomics(amountInRupees, decision.discountBps);
        // Create payment link if appropriate
        let dynamicPaymentLink = null;
        if (decision.nextAction === 'SEND_LINK' || decision.nextAction === 'APPLY_DISCOUNT') {
            dynamicPaymentLink = await createPaymentLink({
                amountInRupees: economics.netRecoverableAmount,
                customerEmail: paymentFailure?.customerEmail || undefined,
                customerContact: paymentFailure?.customerContact || undefined,
                description: `Objection Recovery (${decision.discountBps} bps discount)`,
            });
        }
        let sessionRecord = null;
        if (paymentFailure?.id) {
            try {
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
            catch (dbErr) {
                console.warn('[DB Warning] RecoverySession create skipped:', dbErr.message || dbErr);
            }
        }
        res.status(200).json({
            success: true,
            decision,
            economics,
            paymentLink: dynamicPaymentLink,
            savedToDatabase: !!sessionRecord,
            session: sessionRecord,
        });
    }
    catch (error) {
        console.error('[Recovery Chat Error]', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process chat',
        });
    }
});
// GET /api/recovery/sessions - List all recovery sessions stored in DB
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await prisma.recoverySession.findMany({
            include: { paymentFailure: true },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, count: sessions.length, sessions });
    }
    catch (error) {
        res.status(200).json({ success: false, count: 0, sessions: [], warning: error.message });
    }
});
// GET /api/recovery/failures - List all payment failures stored in DB
router.get('/failures', async (req, res) => {
    try {
        const failures = await prisma.paymentFailure.findMany({
            include: { recoverySessions: true },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, count: failures.length, failures });
    }
    catch (error) {
        res.status(200).json({ success: false, count: 0, failures: [], warning: error.message });
    }
});
export default router;
//# sourceMappingURL=recovery.js.map