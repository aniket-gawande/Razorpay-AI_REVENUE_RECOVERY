import { Router } from 'express';
import { recoveryAgentApp } from '../services/agent/recoveryAgent';
import { triagePaymentFailure } from '../services/triageEngine';
import { enforcePolicyGuard } from '../services/policyGuard';
import { calculateUnitEconomics } from '../services/unitEconomics';
import { createPaymentLink } from '../services/razorpay';
import { prisma } from '../db';
const router = Router();
router.post('/razorpay', async (req, res) => {
    try {
        const eventId = req.headers['x-razorpay-event-id'] || 'evt_default';
        const { event, payload } = req.body;
        console.log(`[Webhook Received] Event: ${event}, Event ID: ${eventId}`);
        if (event === 'payment.failed') {
            const payment = payload?.payment?.entity || {};
            const paymentId = payment.id || `pay_${Date.now()}`;
            const orderId = payment.order_id || null;
            const customerEmail = payment.email || null;
            const customerContact = payment.contact || null;
            const amountInRupees = (payment.amount || 0) / 100;
            const failureReason = (payment.error_code || payment.error_description || 'PAYMENT_FAILED');
            const customerMessage = (payment.error_description || 'My payment failed');
            // 1. Failure Triage Analysis
            const triage = triagePaymentFailure(failureReason, amountInRupees);
            // 2. Save or update PaymentFailure in database safely
            let paymentFailure = null;
            try {
                paymentFailure = await prisma.paymentFailure.upsert({
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
            }
            catch (dbErr) {
                console.warn('[DB Warning] PaymentFailure record write skipped:', dbErr.message || dbErr);
            }
            // 3. Invoke recovery agent state graph
            const agentResult = await recoveryAgentApp.invoke({
                customerMessage,
                amountInRupees,
                failureReason,
                retryCount: 0,
                decision: null,
                validationError: null,
            });
            const rawDecision = agentResult?.decision || {
                nextAction: 'SEND_LINK',
                discountBps: 0,
                promiseDate: null,
                customerFacingMessage: 'Here is your secure link to retry payment.',
                internalReasoning: 'Default fallback response',
            };
            // 4. Policy Guard & Unit Economics Enforcement
            const decision = enforcePolicyGuard(rawDecision);
            const economics = calculateUnitEconomics(amountInRupees, decision.discountBps);
            // 5. Generate Payment Link if action is SEND_LINK or APPLY_DISCOUNT
            let dynamicPaymentLink = null;
            if (decision.nextAction === 'SEND_LINK' || decision.nextAction === 'APPLY_DISCOUNT') {
                dynamicPaymentLink = await createPaymentLink({
                    amountInRupees: economics.netRecoverableAmount,
                    customerEmail: customerEmail || undefined,
                    customerContact: customerContact || undefined,
                    description: `Recovery Payment (${decision.discountBps} bps discount)`,
                });
            }
            // 6. Save RecoverySession in database safely
            let recoverySession = null;
            if (paymentFailure?.id) {
                try {
                    recoverySession = await prisma.recoverySession.create({
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
                    console.warn('[DB Warning] RecoverySession record write skipped:', dbErr.message || dbErr);
                }
            }
            res.status(200).json({
                success: true,
                eventId,
                paymentFailure,
                triage,
                economics,
                paymentLink: dynamicPaymentLink,
                recoverySession,
                decision,
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: `Event '${event}' acknowledged.`,
        });
    }
    catch (error) {
        console.error('[Webhook Error]', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal Server Error',
        });
    }
});
export default router;
//# sourceMappingURL=webhook.js.map