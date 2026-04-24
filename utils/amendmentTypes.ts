export type AmendmentVoteState = 'pending' | 'approved' | 'rejected';

export type AmendmentRequest = {
  id: string;
  roundId: string;
  roundDate: string;
  requesterId: string;
  requesterName: string;
  originalValues: { totalScore: number; holes: number; course: string };
  proposedValues: { totalScore: number; holes: number; course: string };
  reason: string;
  voters: Array<{ userId: string; name: string; vote: AmendmentVoteState; votedAt: number | null }>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  consumed?: boolean;
  rejectedByName?: string;
};
