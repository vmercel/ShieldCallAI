/**
 * GhostAI Responder™ v1.0
 * Finite-State Conversational AI Engine for Ghost Mode
 *
 * Architecture: Contextual Intent Classification + State Machine Response Selection
 * + expo-speech Text-to-Speech synthesis
 *
 * The GhostAI:
 * 1. Classifies each caller statement into one of 12 conversational intents
 * 2. Transitions through a conversation state machine
 * 3. Selects the optimal response from a curated response library
 * 4. Synthesizes speech via expo-speech with the selected AI persona voice
 * 5. Tracks information gathered (purpose, identity, urgency claims)
 * 6. Surfaces structured intelligence back to the user
 *
 * In Expose Mode: switches to time-wasting response strategy
 * that maximizes scammer engagement while harvesting intelligence.
 */

import * as Speech from 'expo-speech';

export type ConversationState =
  | 'greeting'
  | 'purpose_inquiry'
  | 'identity_verification'
  | 'stalling'
  | 'escalation_detected'
  | 'expose_mode'
  | 'closing';

export type CallerIntent =
  | 'greeting'
  | 'identity_claim'
  | 'urgency_push'
  | 'payment_request'
  | 'threat'
  | 'secrecy_demand'
  | 'information_request'
  | 'escalation'
  | 'legitimate_purpose'
  | 'unknown'
  | 'question'
  | 'farewell';

export interface GhostMessage {
  id: string;
  role: 'ai' | 'caller';
  text: string;
  intent?: CallerIntent;
  state?: ConversationState;
  timestamp: number;
  isSpeaking?: boolean;
}

export interface GhostIntelligence {
  callerClaimedIdentity: string | null;
  callerPurpose: string | null;
  urgencyClaims: string[];
  paymentMentioned: boolean;
  identityConsistency: number; // 0-100, drops when identity changes
  informationGathered: string[];
  timeWasted: number; // seconds
}

// ─── INTENT CLASSIFIER ────────────────────────────────────────────────────────

const INTENT_PATTERNS: { intent: CallerIntent; patterns: RegExp[] }[] = [
  {
    intent: 'urgency_push',
    patterns: [
      /immediately|urgent|right now|today|must|have to|deadline|last chance/i,
      /cannot wait|no time|critical|emergency/i,
    ],
  },
  {
    intent: 'payment_request',
    patterns: [
      /pay|payment|gift card|wire|transfer|bitcoin|money|owe|debt/i,
    ],
  },
  {
    intent: 'threat',
    patterns: [
      /arrest|warrant|police|lawsuit|legal action|deport|jail|prison/i,
    ],
  },
  {
    intent: 'secrecy_demand',
    patterns: [
      /don.t tell|keep this between|confidential|secret|don.t share|stay on the line/i,
    ],
  },
  {
    intent: 'identity_claim',
    patterns: [
      /\b(i am|this is|calling from|officer|agent|representative|department)\b/i,
    ],
  },
  {
    intent: 'information_request',
    patterns: [
      /can i speak|put.*on|is.*available|need to speak|account holder|owner/i,
    ],
  },
  {
    intent: 'question',
    patterns: [/\?/],
  },
  {
    intent: 'farewell',
    patterns: [/goodbye|bye|thank you|thanks|hang up|end this/i],
  },
];

function classifyIntent(text: string): CallerIntent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(text))) return intent;
  }
  if (text.trim().length < 10) return 'unknown';
  return 'legitimate_purpose';
}

// ─── RESPONSE LIBRARY ────────────────────────────────────────────────────────

const RESPONSES: Record<ConversationState, Partial<Record<CallerIntent | 'default', string[]>>> = {
  greeting: {
    default: [
      "Hello, this is {persona}, a communications assistant calling on behalf of {name}. How may I direct your call?",
      "Hi there, you have reached {name}'s communications service. This is {persona}. How can I assist you today?",
    ],
    greeting: [
      "Hello! This is {persona}, {name}'s communications agent. What can I help you with?",
    ],
    information_request: [
      "Hello, this is {persona}. I handle communications for {name}. May I ask who is calling and the purpose of your call?",
    ],
  },
  purpose_inquiry: {
    default: [
      "I see. Could you tell me a bit more about the nature of your call so I can make sure {name} is prepared?",
      "That is helpful context. Could you provide a case reference number or any documentation number for this matter?",
    ],
    urgency_push: [
      "I understand this feels urgent. To make sure we handle this correctly, could you provide your official case number?",
    ],
    identity_claim: [
      "Thank you for that information. Could you spell your name and provide your employee ID number so I can verify your credentials?",
    ],
    payment_request: [
      "Interesting. Before we discuss any financial matters, I will need to verify your organization's official contact information. Could you provide your direct callback number and supervisor name?",
    ],
  },
  identity_verification: {
    default: [
      "I appreciate your patience. I am required to verify all callers before connecting them. Could you spell your badge number slowly?",
      "I see. Just to confirm — what department did you say this was from, and is there an official case file number associated with this?",
    ],
    urgency_push: [
      "I understand the urgency you are describing. Standard procedure still requires I note your direct callback number and supervisor's name. Could you provide those?",
    ],
    threat: [
      "I note that you have mentioned legal action. Our legal team will need the relevant case number and the court jurisdiction for our records. Could you provide that?",
    ],
    payment_request: [
      "I want to be sure we handle this payment correctly. Could you confirm the official mailing address where a check could be sent instead? We do not process phone payments.",
    ],
  },
  stalling: {
    default: [
      "I am noting everything you have said. I will need just a moment to relay this information. Please hold.",
      "I want to make sure I have all the details correct. Could you repeat the case number one more time?",
      "Let me pull up the relevant account information. This may take a moment. Could you confirm your name and organization one more time?",
    ],
    urgency_push: [
      "I am moving as quickly as I can. The process still requires verification. Could you hold for just two minutes?",
    ],
  },
  escalation_detected: {
    default: [
      "I notice you seem to feel strongly about this. I want to assure you that I am taking your call very seriously and documenting everything.",
      "I understand. Let me be clear that I am recording this conversation for quality assurance. Could you confirm your name one more time for the record?",
    ],
    threat: [
      "I appreciate you mentioning legal action. I want to be transparent — this call is being recorded and documented. Could you confirm the court order number for our legal team?",
    ],
    payment_request: [
      "I hear your concern about payment. Our financial policy requires all payments to be initiated in writing. Could you email the formal demand letter to our legal department?",
    ],
    secrecy_demand: [
      "I want to be transparent: I am required to notify {name} of all communications on their behalf. I cannot agree to keep information from them.",
    ],
  },
  expose_mode: {
    default: [
      "I am sorry, I did not quite catch that. Could you explain that again from the beginning?",
      "Interesting. And which government agency did you say you represent? Could you spell the full name?",
      "I see. So just to make sure I understand — the payment would go where exactly? And in what form?",
      "I want to make sure {name} has all the details. What was the amount again? And the deadline?",
      "I am writing this all down. What department within the IRS handles this type of enforcement action?",
      "Could you hold for a moment? I am retrieving the relevant information. This may take a little time.",
      "I think I may have misunderstood. Could you start from the beginning and explain the issue one more time?",
      "And if someone wanted to verify this call was legitimate, what official number would they call? The number you are calling from just shows up as unknown.",
    ],
    payment_request: [
      "Gift cards, you said? Which specific gift cards are acceptable? Is there a minimum denomination?",
    ],
    threat: [
      "An arrest warrant, you say. That sounds serious. What is the warrant number? Our legal team will need to reference it.",
    ],
    urgency_push: [
      "I understand. Just so I am absolutely sure, what happens exactly at the deadline? Walk me through the process.",
    ],
  },
  closing: {
    default: [
      "Thank you for your call. I have documented everything and {name} will be notified of this contact. Goodbye.",
      "I appreciate the conversation. Your call has been logged and flagged for review. Have a good day.",
    ],
    farewell: [
      "Thank you. This call has been recorded and documented. Goodbye.",
    ],
  },
};

function getResponse(state: ConversationState, intent: CallerIntent, persona: string, name: string): string {
  const stateResponses = RESPONSES[state];
  const intentResponses = stateResponses[intent] || stateResponses.default || [];
  const pool = intentResponses.length > 0 ? intentResponses : (stateResponses.default || ["I understand. Please give me a moment."]);
  const raw = pool[Math.floor(Math.random() * pool.length)];
  return raw
    .replace(/{persona}/g, persona)
    .replace(/{name}/g, name);
}

// ─── STATE MACHINE TRANSITIONS ────────────────────────────────────────────────

function nextState(current: ConversationState, intent: CallerIntent, messageCount: number, exposeMode: boolean): ConversationState {
  if (exposeMode) return 'expose_mode';

  switch (current) {
    case 'greeting':
      return 'purpose_inquiry';
    case 'purpose_inquiry':
      if (intent === 'threat' || intent === 'payment_request') return 'escalation_detected';
      return 'identity_verification';
    case 'identity_verification':
      if (intent === 'threat' || intent === 'payment_request' || intent === 'urgency_push') return 'escalation_detected';
      if (messageCount > 6) return 'stalling';
      return 'identity_verification';
    case 'stalling':
      if (intent === 'threat') return 'escalation_detected';
      if (messageCount > 10) return 'closing';
      return 'stalling';
    case 'escalation_detected':
      if (messageCount > 8) return 'closing';
      return 'escalation_detected';
    case 'expose_mode':
      if (intent === 'farewell' || messageCount > 20) return 'closing';
      return 'expose_mode';
    case 'closing':
      return 'closing';
  }
}

// ─── GHOST AI RESPONDER CLASS ─────────────────────────────────────────────────

export class GhostAIResponder {
  private state: ConversationState = 'greeting';
  private messages: GhostMessage[] = [];
  private intelligence: GhostIntelligence = {
    callerClaimedIdentity: null,
    callerPurpose: null,
    urgencyClaims: [],
    paymentMentioned: false,
    identityConsistency: 100,
    informationGathered: [],
    timeWasted: 0,
  };
  private exposeMode = false;
  private startTime = Date.now();
  private isSpeaking = false;
  private personaName = 'Alex';
  private userName = 'the account holder';
  private speechRate = 0.9;
  private speechPitch = 1.0;

  setPersona(name: string, rate = 0.9, pitch = 1.0) {
    this.personaName = name;
    this.speechRate = rate;
    this.speechPitch = pitch;
  }

  enableExposeMode() {
    this.exposeMode = true;
    this.state = 'expose_mode';
  }

  /**
   * Process a new caller utterance.
   * Returns the AI's response message.
   */
  async processCallerUtterance(
    callerText: string,
    onAIMessage: (msg: GhostMessage) => void
  ): Promise<GhostMessage> {
    // Log caller message
    const callerMsg: GhostMessage = {
      id: `caller-${Date.now()}`,
      role: 'caller',
      text: callerText,
      intent: classifyIntent(callerText),
      timestamp: Date.now(),
    };
    this.messages.push(callerMsg);

    // Update intelligence
    this.updateIntelligence(callerText, callerMsg.intent!);

    // Transition state
    const intent = callerMsg.intent!;
    this.state = nextState(this.state, intent, this.messages.length, this.exposeMode);

    // Generate response
    const responseText = getResponse(this.state, intent, this.personaName, this.userName);

    const aiMsg: GhostMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text: responseText,
      state: this.state,
      timestamp: Date.now(),
      isSpeaking: true,
    };

    this.messages.push(aiMsg);
    onAIMessage(aiMsg);

    // Speak the response
    await this.speak(responseText);

    return aiMsg;
  }

  /**
   * Generate the opening greeting automatically
   */
  async greet(onAIMessage: (msg: GhostMessage) => void): Promise<GhostMessage> {
    const text = getResponse('greeting', 'greeting', this.personaName, this.userName);
    const msg: GhostMessage = {
      id: `ai-${Date.now()}`,
      role: 'ai',
      text,
      state: 'greeting',
      timestamp: Date.now(),
      isSpeaking: true,
    };
    this.messages.push(msg);
    onAIMessage(msg);
    await this.speak(text);
    return msg;
  }

  getIntelligence(): GhostIntelligence {
    this.intelligence.timeWasted = Math.round((Date.now() - this.startTime) / 1000);
    return { ...this.intelligence };
  }

  getMessages(): GhostMessage[] {
    return [...this.messages];
  }

  getState(): ConversationState {
    return this.state;
  }

  async stopSpeaking() {
    await Speech.stop();
    this.isSpeaking = false;
  }

  reset() {
    this.state = 'greeting';
    this.messages = [];
    this.exposeMode = false;
    this.startTime = Date.now();
    this.intelligence = {
      callerClaimedIdentity: null,
      callerPurpose: null,
      urgencyClaims: [],
      paymentMentioned: false,
      identityConsistency: 100,
      informationGathered: [],
      timeWasted: 0,
    };
    Speech.stop();
  }

  private async speak(text: string): Promise<void> {
    return new Promise(resolve => {
      Speech.stop();
      Speech.speak(text, {
        language: 'en-US',
        rate: this.speechRate,
        pitch: this.speechPitch,
        onDone: resolve,
        onError: () => resolve(),
      });
    });
  }

  private updateIntelligence(text: string, intent: CallerIntent) {
    if (intent === 'identity_claim') {
      const identityMatch = text.match(/\b(i am|this is|officer|agent|from)\s+([A-Za-z\s]+)/i);
      if (identityMatch) {
        const claimed = identityMatch[2]?.trim();
        if (this.intelligence.callerClaimedIdentity && claimed !== this.intelligence.callerClaimedIdentity) {
          this.intelligence.identityConsistency -= 30;
        }
        this.intelligence.callerClaimedIdentity = claimed || null;
      }
    }

    if (intent === 'urgency_push' || intent === 'threat') {
      this.intelligence.urgencyClaims.push(text.substring(0, 80));
    }

    if (intent === 'payment_request') {
      this.intelligence.paymentMentioned = true;
    }

    if (text.length > 15) {
      this.intelligence.informationGathered.push(text.substring(0, 100));
    }
  }
}
