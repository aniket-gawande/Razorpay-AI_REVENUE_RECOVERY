export interface TriageResult {
  category: 'TECH_FAIL' | 'FUNDS_FAIL' | 'EXPIRED_METHOD' | 'AUTH_FAIL' | 'USER_ABORT' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  retryRecommended: boolean;
  retryDelayHours: number;
  recommendedStrategy: string;
}

export function triagePaymentFailure(failureReason: string, amountInRupees: number): TriageResult {
  const reasonUpper = (failureReason || '').toUpperCase();

  if (reasonUpper.includes('TIMEOUT') || reasonUpper.includes('GATEWAY') || reasonUpper.includes('NETWORK') || reasonUpper.includes('500')) {
    return {
      category: 'TECH_FAIL',
      severity: 'LOW',
      retryRecommended: true,
      retryDelayHours: 1,
      recommendedStrategy: 'Immediate or short-delay automated payment link dispatch.',
    };
  }

  if (reasonUpper.includes('INSUFFICIENT') || reasonUpper.includes('FUNDS') || reasonUpper.includes('BALANCE')) {
    return {
      category: 'FUNDS_FAIL',
      severity: 'HIGH',
      retryRecommended: true,
      retryDelayHours: 48,
      recommendedStrategy: 'Schedule P2P payment or offer micro-discount based on unit economics.',
    };
  }

  if (reasonUpper.includes('EXPIRED') || reasonUpper.includes('CARD_EXPIRED')) {
    return {
      category: 'EXPIRED_METHOD',
      severity: 'MEDIUM',
      retryRecommended: true,
      retryDelayHours: 0,
      recommendedStrategy: 'Prompt user to update payment method with fresh checkout link.',
    };
  }

  if (reasonUpper.includes('AUTH') || reasonUpper.includes('OTP') || reasonUpper.includes('AUTHENTICATION')) {
    return {
      category: 'AUTH_FAIL',
      severity: 'LOW',
      retryRecommended: true,
      retryDelayHours: 2,
      recommendedStrategy: 'Send 1-click re-authentication dynamic payment link.',
    };
  }

  if (reasonUpper.includes('CANCEL') || reasonUpper.includes('ABORT') || reasonUpper.includes('DECLINED')) {
    return {
      category: 'USER_ABORT',
      severity: 'HIGH',
      retryRecommended: false,
      retryDelayHours: 24,
      recommendedStrategy: 'Initiate interactive objection handling AI chat.',
    };
  }

  return {
    category: 'UNKNOWN',
    severity: 'MEDIUM',
    retryRecommended: true,
    retryDelayHours: 12,
    recommendedStrategy: 'Standard payment link dispatch with objection handling standby.',
  };
}
