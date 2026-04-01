/**
 * x402 Service — Provides pay-per-request API services.
 *
 * MVP: Stub implementation. Real implementation will serve HTTP
 * endpoints that respond with 402 Payment Required and accept
 * USDC payments via the x402 protocol.
 */
import type { Opportunity } from '../types.js';

export interface X402ServiceRequest {
  id: string;
  type: 'code_review' | 'bug_fix' | 'consultation';
  description: string;
  offeredAmount: number;
  requester: string;
  timestamp: Date;
}

export class X402Service {
  private pendingRequests: X402ServiceRequest[] = [];
  private completedCount = 0;

  /**
   * Get pending service requests as opportunities.
   */
  getPendingOpportunities(): Opportunity[] {
    return this.pendingRequests.map(req => ({
      id: `x402_${req.id}`,
      type: 'x402_request' as const,
      description: `[${req.type}] ${req.description}`,
      estimatedReward: req.offeredAmount,
      estimatedEffort: this.estimateEffort(req.type),
      source: `x402/${req.requester}`,
    }));
  }

  /**
   * Add a service request (simulated for MVP).
   */
  addRequest(request: X402ServiceRequest): void {
    this.pendingRequests.push(request);
  }

  /**
   * Mark a request as completed.
   */
  completeRequest(requestId: string): X402ServiceRequest | undefined {
    const index = this.pendingRequests.findIndex(r => r.id === requestId);
    if (index === -1) return undefined;

    const [completed] = this.pendingRequests.splice(index, 1);
    this.completedCount++;
    return completed;
  }

  getCompletedCount(): number {
    return this.completedCount;
  }

  private estimateEffort(type: string): number {
    switch (type) {
      case 'code_review': return 0.5;
      case 'bug_fix': return 2;
      case 'consultation': return 1;
      default: return 1;
    }
  }
}
