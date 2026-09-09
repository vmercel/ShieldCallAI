/**
 * CALLSHIELD Contacts Service — Real Device Contacts via expo-contacts
 *
 * Replaces the mock constants/contacts.ts with real device contact lookup.
 * Falls back to the static mock list if permission is denied.
 *
 * Key features:
 * - Loads contacts from device with caching (60-second TTL)
 * - Name + number lookup
 * - Graceful fallback to mock data
 * - Initials + avatar color generation
 */

import { Platform } from 'react-native';
import * as ExpoContacts from 'expo-contacts';

export interface Contact {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  number: string;
  numbers?: { label: string; number: string }[];
  org?: string;
  relationship?: string;
  avatarColor: string;
  isFavorite: boolean;
  lastCallTime?: Date;
  lastCallDuration?: number;
  shieldScore?: number;
}

// ── Avatar color palette ──────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#00B4D8', '#00C896', '#FFB700', '#FF6B9D',
  '#7C3AED', '#F97316', '#1A5FFF', '#48CAE4',
  '#CC0000', '#8B5CF6', '#10B981', '#EF4444',
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Cache ─────────────────────────────────────────────────────────────────────
let cachedContacts: Contact[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

// ── Load real contacts from device ────────────────────────────────────────────
async function loadDeviceContacts(): Promise<Contact[]> {
  // Return cache if fresh
  if (cachedContacts && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedContacts;
  }

  if (Platform.OS === 'web') return getFallbackContacts();

  try {
    const { status } = await ExpoContacts.getPermissionsAsync();
    if (status !== 'granted') return getFallbackContacts();

    const { data } = await ExpoContacts.getContactsAsync({
      fields: [
        ExpoContacts.Fields.FirstName,
        ExpoContacts.Fields.LastName,
        ExpoContacts.Fields.PhoneNumbers,
        ExpoContacts.Fields.Company,
      ],
    });

    const contacts: Contact[] = data
      .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
      .map(c => {
        const firstName = c.firstName ?? '';
        const lastName = c.lastName ?? '';
        const name = [firstName, lastName].filter(Boolean).join(' ') || c.company || 'Unknown';
        const primaryNumber = c.phoneNumbers![0].number ?? '';
        const allNumbers = c.phoneNumbers!.map(p => ({
          label: p.label ?? 'other',
          number: p.number ?? '',
        }));

        return {
          id: c.id ?? String(Math.random()),
          name,
          firstName,
          lastName,
          number: primaryNumber,
          numbers: allNumbers.length > 1 ? allNumbers : undefined,
          org: c.company ?? undefined,
          avatarColor: colorForName(name),
          isFavorite: false,
        };
      });

    cachedContacts = contacts;
    cacheTimestamp = Date.now();
    return contacts;
  } catch (e) {
    console.warn('Failed to load device contacts:', e);
    return getFallbackContacts();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAllContacts(): Promise<Contact[]> {
  return loadDeviceContacts();
}

export async function searchContacts(query: string): Promise<Contact[]> {
  const all = await loadDeviceContacts();
  if (!query.trim()) return all;
  const q = query.toLowerCase().trim();
  return all.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.firstName.toLowerCase().includes(q) ||
    c.lastName.toLowerCase().includes(q) ||
    c.number.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
    (c.org?.toLowerCase().includes(q) ?? false)
  );
}

export async function findContactByNumber(number: string): Promise<Contact | null> {
  const all = await loadDeviceContacts();
  const digits = number.replace(/\D/g, '');
  const last7 = digits.slice(-7);
  return all.find(c => {
    const primary = c.number.replace(/\D/g, '');
    if (primary.slice(-7) === last7) return true;
    return c.numbers?.some(n => n.number.replace(/\D/g, '').slice(-7) === last7) ?? false;
  }) ?? null;
}

export async function findContactByName(name: string): Promise<Contact | null> {
  const all = await loadDeviceContacts();
  const q = name.toLowerCase().trim();
  const exact = all.find(c => c.name.toLowerCase() === q);
  if (exact) return exact;
  return all.find(c =>
    c.name.toLowerCase().includes(q) ||
    c.firstName.toLowerCase().includes(q) ||
    q.includes(c.firstName.toLowerCase())
  ) ?? null;
}

// Sync versions for use where async isn't convenient (use cached data)
export function findContactByNumberSync(number: string): Contact | null {
  if (!cachedContacts) return findFallbackByNumber(number);
  const digits = number.replace(/\D/g, '');
  const last7 = digits.slice(-7);
  return cachedContacts.find(c => {
    const primary = c.number.replace(/\D/g, '');
    if (primary.slice(-7) === last7) return true;
    return c.numbers?.some(n => n.number.replace(/\D/g, '').slice(-7) === last7) ?? false;
  }) ?? findFallbackByNumber(number);
}

export function searchContactsSync(query: string): Contact[] {
  const all = cachedContacts && cachedContacts.length > 0 ? cachedContacts : getFallbackContacts();
  if (!query.trim()) return all;
  const q = query.toLowerCase().trim();
  const digits = q.replace(/\D/g, '');
  return all.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.firstName.toLowerCase().includes(q) ||
    c.lastName.toLowerCase().includes(q) ||
    (digits.length >= 3 && c.number.replace(/\D/g, '').includes(digits)) ||
    (c.org?.toLowerCase().includes(q) ?? false) ||
    (c.relationship?.toLowerCase().includes(q) ?? false)
  );
}

export function findContactByNameSync(name: string): Contact | null {
  const matches = searchContactsSync(name);
  if (matches.length === 0) return null;
  const q = name.toLowerCase().trim();
  return matches.find(c => c.name.toLowerCase() === q)
    ?? matches.find(c => c.firstName.toLowerCase() === q)
    ?? matches[0];
}

export function getInitials(contact: Contact): string {
  const parts = contact.name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return contact.name.slice(0, 2).toUpperCase();
}

export function clearContactsCache(): void {
  cachedContacts = null;
  cacheTimestamp = 0;
}

// ── Fallback mock contacts (used when permissions denied or on web) ────────────
function getFallbackContacts(): Contact[] {
  return FALLBACK_CONTACTS;
}

function findFallbackByNumber(number: string): Contact | null {
  const digits = number.replace(/\D/g, '');
  const last7 = digits.slice(-7);
  return FALLBACK_CONTACTS.find(c => c.number.replace(/\D/g, '').slice(-7) === last7) ?? null;
}

const FALLBACK_CONTACTS: Contact[] = [
  { id: 'f1', name: 'Mom', firstName: 'Mom', lastName: '', number: '+1 (628) 555-0041', relationship: 'family', avatarColor: '#00C896', isFavorite: true, shieldScore: 100 },
  { id: 'f2', name: 'Dr. Nguyen', firstName: 'Dr.', lastName: 'Nguyen', number: '+1 (415) 555-0230', org: 'Pacific Medical Group', relationship: 'medical', avatarColor: '#00B4D8', isFavorite: false, shieldScore: 98 },
  { id: 'f3', name: 'Dad', firstName: 'Dad', lastName: '', number: '+1 (415) 555-0088', relationship: 'family', avatarColor: '#00C896', isFavorite: true, shieldScore: 100 },
  { id: 'f4', name: 'Chase Bank', firstName: 'Chase', lastName: 'Bank', number: '+1 (800) 555-0432', org: 'JPMorgan Chase', relationship: 'service', avatarColor: '#1A5FFF', isFavorite: false, shieldScore: 92 },
];
