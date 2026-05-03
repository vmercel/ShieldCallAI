export type ThreatLevel = 'safe' | 'warning' | 'danger';

export interface CallRecord {
  id: string;
  callerName: string;
  callerNumber: string;
  callerOrg?: string;
  timestamp: Date;
  duration: number; // seconds
  threatLevel: ThreatLevel;
  threatScore: number; // 0-100
  summary: string;
  ghostHandled: boolean;
  scamType?: string;
  tags: string[];
  aiNotes?: string;
}

export interface ScamAlert {
  id: string;
  number: string;
  scamType: string;
  reportCount: number;
  lastSeen: Date;
  region: string;
}

export interface MonthlyStats {
  scamsBlocked: number;
  ghostModeCalls: number;
  totalCalls: number;
  estimatedSavings: number;
  topScamTypes: { type: string; count: number }[];
  safeCallsPercent: number;
}

export const MOCK_CALLS: CallRecord[] = [
  {
    id: '1',
    callerName: 'Unknown Caller',
    callerNumber: '+1 (202) 555-0147',
    callerOrg: 'VoIP Service',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    duration: 187,
    threatLevel: 'danger',
    threatScore: 94,
    summary: 'Caller claimed to be IRS agent demanding immediate payment via gift cards to avoid arrest. Classic IRS impersonation scam.',
    ghostHandled: true,
    scamType: 'IRS Impersonation',
    tags: ['IRS', 'Impersonation', 'Urgent Payment'],
    aiNotes: 'AI wasted 3m 7s of scammer time. Payment request detected at 0:42.',
  },
  {
    id: '2',
    callerName: 'Bayside Dental',
    callerNumber: '+1 (415) 555-0193',
    callerOrg: 'Bayside Dental Group',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    duration: 62,
    threatLevel: 'safe',
    threatScore: 4,
    summary: 'Appointment confirmation for Friday at 10 AM. No action required.',
    ghostHandled: true,
    tags: ['Appointment', 'Dental'],
    aiNotes: 'Auto-confirmed appointment based on calendar.',
  },
  {
    id: '3',
    callerName: 'Mom',
    callerNumber: '+1 (628) 555-0041',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    duration: 340,
    threatLevel: 'safe',
    threatScore: 0,
    summary: 'Personal call with Mom. Discussed weekend plans and family dinner.',
    ghostHandled: false,
    tags: ['Family', 'Personal'],
  },
  {
    id: '4',
    callerName: 'Unknown Caller',
    callerNumber: '+1 (800) 555-0982',
    callerOrg: 'Spoofed Number',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
    duration: 241,
    threatLevel: 'danger',
    threatScore: 88,
    summary: 'Social Security Administration impersonation. Claimed SSN was suspended. Requested wire transfer.',
    ghostHandled: true,
    scamType: 'SSA Impersonation',
    tags: ['SSA', 'Impersonation', 'Wire Transfer'],
    aiNotes: 'Deepfake voice signature detected. Community threat score: HIGH.',
  },
  {
    id: '5',
    callerName: 'Dr. Nguyen Office',
    callerNumber: '+1 (415) 555-0230',
    callerOrg: 'Pacific Medical Group',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    duration: 95,
    threatLevel: 'safe',
    threatScore: 2,
    summary: 'Follow-up call regarding test results. Doctor requests callback.',
    ghostHandled: false,
    tags: ['Medical', 'Follow-up'],
  },
  {
    id: '6',
    callerName: 'Unknown Caller',
    callerNumber: '+1 (305) 555-0771',
    callerOrg: 'VoIP Service',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
    duration: 45,
    threatLevel: 'warning',
    threatScore: 61,
    summary: 'Tech support scam attempt. Caller claimed Microsoft detected a virus on device. Call ended before escalation.',
    ghostHandled: true,
    scamType: 'Tech Support',
    tags: ['Tech Support', 'Microsoft Impersonation'],
    aiNotes: 'Scripted cadence detected. Call terminated by AI.',
  },
  {
    id: '7',
    callerName: 'Chase Bank',
    callerNumber: '+1 (800) 555-0432',
    callerOrg: 'JPMorgan Chase',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
    duration: 128,
    threatLevel: 'safe',
    threatScore: 8,
    summary: 'Legitimate fraud alert regarding recent card transaction. Verified via Caller ID.',
    ghostHandled: false,
    tags: ['Banking', 'Fraud Alert'],
  },
];

export const MOCK_SCAM_ALERTS: ScamAlert[] = [
  {
    id: 'a1',
    number: '+1 (202) 555-0147',
    scamType: 'IRS Impersonation',
    reportCount: 1847,
    lastSeen: new Date(Date.now() - 1000 * 60 * 12),
    region: 'National',
  },
  {
    id: 'a2',
    number: '+1 (800) 555-0982',
    scamType: 'SSA Impersonation',
    reportCount: 3291,
    lastSeen: new Date(),
    region: 'California',
  },
  {
    id: 'a3',
    number: '+1 (305) 555-9910',
    scamType: 'Medicare Fraud',
    reportCount: 892,
    lastSeen: new Date(Date.now() - 1000 * 60 * 30),
    region: 'Florida',
  },
  {
    id: 'a4',
    number: '+1 (678) 555-0441',
    scamType: 'Grandparent Scam',
    reportCount: 432,
    lastSeen: new Date(Date.now() - 1000 * 60 * 90),
    region: 'Georgia',
  },
];

export const MOCK_STATS: MonthlyStats = {
  scamsBlocked: 12,
  ghostModeCalls: 9,
  totalCalls: 47,
  estimatedSavings: 8400,
  safeCallsPercent: 74,
  topScamTypes: [
    { type: 'IRS Impersonation', count: 5 },
    { type: 'Tech Support', count: 3 },
    { type: 'SSA Impersonation', count: 2 },
    { type: 'Medicare Fraud', count: 2 },
  ],
};

export const GHOST_CONVERSATION = [
  { role: 'ai', text: 'Hello, this is Alex, a communications assistant calling on behalf of the account holder. How can I help you today?' },
  { role: 'caller', text: 'Yes, this is Officer Davis from the IRS. I need to speak with the account holder immediately about an urgent tax matter.' },
  { role: 'ai', text: 'I understand. Could you provide your IRS badge number and a callback number so we can verify your identity?' },
  { role: 'caller', text: 'There is no time for that. The account holder owes $4,200 in back taxes and will be arrested today unless payment is made immediately.' },
  { role: 'ai', text: 'I see. Just to clarify the process — could you confirm the case number and which IRS district office you are calling from?' },
  { role: 'caller', text: 'You need to stop asking questions. This is urgent! Get me the account holder now or face legal consequences.' },
  { role: 'ai', text: 'I appreciate your patience. I am required to verify all government callers. The IRS typically contacts taxpayers by mail first. Could you explain why that standard process was skipped?' },
  { role: 'caller', text: 'This is a special enforcement action. Tell your account holder they must pay now using Google Play gift cards.' },
];

export const AI_DIALER_SCENARIOS = [
  { id: 'd1', icon: 'local-pharmacy', label: 'Refill Prescription', example: 'Call CVS Pharmacy and refill my blood pressure medication' },
  { id: 'd2', icon: 'event', label: 'Confirm Appointment', example: 'Call Dr. Nguyen and confirm my appointment on the 15th' },
  { id: 'd3', icon: 'cancel', label: 'Cancel Subscription', example: 'Cancel my Comcast subscription and get confirmation' },
  { id: 'd4', icon: 'headset', label: 'File Complaint', example: 'Call my insurance company about claim denial #A-4821' },
  { id: 'd5', icon: 'build', label: 'Schedule Service', example: 'Schedule a plumber for a leaky faucet next week' },
  { id: 'd6', icon: 'local-shipping', label: 'Track Delivery', example: 'Call UPS and find out where my package is' },
];
