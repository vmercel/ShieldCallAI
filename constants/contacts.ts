/**
 * CALLSHIELD Phone Book
 * Mock contact database — replace with real device contacts via expo-contacts in production
 */

export interface Contact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  number: string;           // Primary phone
  numbers?: { label: string; number: string }[];
  org?: string;
  relationship?: string;    // family | work | medical | service | unknown
  avatarColor: string;      // Initials avatar color
  isFavorite: boolean;
  lastCallTime?: Date;
  lastCallDuration?: number;
  shieldScore?: number;     // Historical trust score 0–100
}

export const CONTACTS: Contact[] = [
  {
    id: 'c1',
    name: 'Mom',
    firstName: 'Patricia',
    lastName: 'Johnson',
    number: '+1 (628) 555-0041',
    relationship: 'family',
    avatarColor: '#00C896',
    isFavorite: true,
    lastCallTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
    lastCallDuration: 340,
    shieldScore: 100,
  },
  {
    id: 'c2',
    name: 'Dr. Nguyen',
    firstName: 'Minh',
    lastName: 'Nguyen',
    number: '+1 (415) 555-0230',
    org: 'Pacific Medical Group',
    relationship: 'medical',
    avatarColor: '#00B4D8',
    isFavorite: false,
    numbers: [
      { label: 'office', number: '+1 (415) 555-0230' },
      { label: 'nurse', number: '+1 (415) 555-0231' },
    ],
    lastCallTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
    lastCallDuration: 95,
    shieldScore: 98,
  },
  {
    id: 'c3',
    name: 'Bayside Dental',
    firstName: 'Bayside',
    lastName: 'Dental',
    number: '+1 (415) 555-0193',
    org: 'Bayside Dental Group',
    relationship: 'medical',
    avatarColor: '#48CAE4',
    isFavorite: false,
    lastCallTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
    lastCallDuration: 62,
    shieldScore: 97,
  },
  {
    id: 'c4',
    name: 'Chase Bank',
    firstName: 'Chase',
    lastName: 'Bank',
    number: '+1 (800) 555-0432',
    org: 'JPMorgan Chase',
    relationship: 'service',
    avatarColor: '#1A5FFF',
    isFavorite: false,
    lastCallTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
    lastCallDuration: 128,
    shieldScore: 92,
  },
  {
    id: 'c5',
    name: 'Marcus',
    firstName: 'Marcus',
    lastName: 'Williams',
    number: '+1 (310) 555-0178',
    relationship: 'work',
    avatarColor: '#FFB700',
    isFavorite: true,
    shieldScore: 100,
  },
  {
    id: 'c6',
    name: 'Sarah Chen',
    firstName: 'Sarah',
    lastName: 'Chen',
    number: '+1 (510) 555-0092',
    relationship: 'work',
    avatarColor: '#FF6B9D',
    isFavorite: false,
    shieldScore: 100,
  },
  {
    id: 'c7',
    name: 'CVS Pharmacy',
    firstName: 'CVS',
    lastName: 'Pharmacy',
    number: '+1 (800) 555-7227',
    org: 'CVS Health',
    relationship: 'service',
    avatarColor: '#CC0000',
    isFavorite: false,
    numbers: [
      { label: 'pharmacy', number: '+1 (800) 555-7227' },
      { label: 'refills', number: '+1 (800) 555-7228' },
    ],
    shieldScore: 95,
  },
  {
    id: 'c8',
    name: 'Dad',
    firstName: 'Robert',
    lastName: 'Johnson',
    number: '+1 (415) 555-0088',
    relationship: 'family',
    avatarColor: '#00C896',
    isFavorite: true,
    shieldScore: 100,
  },
  {
    id: 'c9',
    name: 'James Cooper',
    firstName: 'James',
    lastName: 'Cooper',
    number: '+1 (212) 555-0334',
    org: 'Apex Insurance',
    relationship: 'work',
    avatarColor: '#7C3AED',
    isFavorite: false,
    shieldScore: 99,
  },
  {
    id: 'c10',
    name: 'State Farm',
    firstName: 'State',
    lastName: 'Farm',
    number: '+1 (800) 555-2732',
    org: 'State Farm Insurance',
    relationship: 'service',
    avatarColor: '#CC0000',
    isFavorite: false,
    shieldScore: 93,
  },
  {
    id: 'c11',
    name: 'Elena Torres',
    firstName: 'Elena',
    lastName: 'Torres',
    number: '+1 (650) 555-0211',
    relationship: 'work',
    avatarColor: '#F97316',
    isFavorite: false,
    shieldScore: 100,
  },
  {
    id: 'c12',
    name: 'David Kim',
    firstName: 'David',
    lastName: 'Kim',
    number: '+1 (718) 555-0076',
    relationship: 'family',
    avatarColor: '#8B5CF6',
    isFavorite: false,
    shieldScore: 100,
  },
];

export function searchContacts(query: string): Contact[] {
  if (!query.trim()) return CONTACTS;
  const q = query.toLowerCase().trim();
  return CONTACTS.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.firstName.toLowerCase().includes(q) ||
    c.lastName.toLowerCase().includes(q) ||
    c.number.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
    (c.org?.toLowerCase().includes(q) ?? false) ||
    (c.relationship?.toLowerCase().includes(q) ?? false)
  );
}

export function findContactByName(name: string): Contact | null {
  const q = name.toLowerCase().trim();
  // Exact match first
  const exact = CONTACTS.find(c => c.name.toLowerCase() === q);
  if (exact) return exact;
  // Partial match
  return CONTACTS.find(c =>
    c.name.toLowerCase().includes(q) ||
    c.firstName.toLowerCase().includes(q) ||
    q.includes(c.firstName.toLowerCase())
  ) ?? null;
}

export function findContactByNumber(number: string): Contact | null {
  const digits = number.replace(/\D/g, '');
  return CONTACTS.find(c => {
    const primary = c.number.replace(/\D/g, '');
    if (primary.endsWith(digits) || digits.endsWith(primary.slice(-7))) return true;
    return c.numbers?.some(n => n.number.replace(/\D/g, '').endsWith(digits)) ?? false;
  }) ?? null;
}

export function getInitials(contact: Contact): string {
  const parts = contact.name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return contact.name.slice(0, 2).toUpperCase();
}

export function getFavorites(): Contact[] {
  return CONTACTS.filter(c => c.isFavorite);
}
