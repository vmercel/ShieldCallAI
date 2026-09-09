/**
 * Device phone book. Lives in its own module so Fast Refresh cannot keep a
 * stale nested ContactsTab that still called a removed searchContacts import.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Linking, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { Contact, getInitials, filterContacts } from '../services/contactsService';

function Avatar({ contact, size = 46 }: { contact: Contact; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: contact.avatarColor + '33',
      borderWidth: 1.5, borderColor: contact.avatarColor + '55',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: '700', color: contact.avatarColor }}>
        {getInitials(contact)}
      </Text>
    </View>
  );
}

export function ContactsBook({
  onContact,
  contacts,
  permission,
  loading,
  onAskPermission,
}: {
  onContact: (c: Contact) => void;
  contacts: Contact[];
  permission: 'unknown' | 'granted' | 'denied';
  loading?: boolean;
  onAskPermission: () => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterContacts(contacts, query), [contacts, query]);

  const sections = useMemo(() => {
    const groups = results.reduce<Record<string, Contact[]>>((acc, c) => {
      const key = query.trim() ? 'Results' : (c.name[0] || '#').toUpperCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [results, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.search}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search this phone"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptyText}>Loading contacts from this phone</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {sections.map(([letter, people]) => (
            <View key={letter}>
              <Text style={styles.letter}>{letter}</Text>
              {people.map(c => (
                <TouchableOpacity key={c.id} style={styles.row} onPress={() => onContact(c)} activeOpacity={0.8}>
                  <Avatar contact={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.name}</Text>
                    <Text style={styles.num}>{c.number}</Text>
                    {c.org ? <Text style={styles.org}>{c.org}</Text> : null}
                  </View>
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => onContact(c)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="phone" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {permission !== 'granted' && (
            <View style={styles.empty}>
              <MaterialIcons name="contacts" size={48} color={Colors.primary} />
              <Text style={styles.emptyTitle}>Allow Contacts</Text>
              <Text style={styles.emptyText}>
                ShieldCall reads this phone's address book so you can say a name and dial, like a Phone app.
              </Text>
              <TouchableOpacity style={styles.permBtn} onPress={onAskPermission} activeOpacity={0.85}>
                <Text style={styles.permBtnText}>Grant access</Text>
              </TouchableOpacity>
              {permission === 'denied' ? (
                <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
                  <Text style={styles.settingsBtnText}>Open Settings</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {permission === 'granted' && results.length === 0 && (
            <View style={styles.empty}>
              <MaterialIcons name="person-search" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {query.trim() ? 'No matching contacts' : 'No contacts with phone numbers on this device'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false },
  letter: {
    fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: Colors.textMuted,
    paddingHorizontal: 4, paddingVertical: 6, letterSpacing: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
  num: { fontSize: FontSize.xs, color: Colors.textSecondary },
  org: { fontSize: FontSize.xs, color: Colors.textMuted },
  callBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primaryGlow,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  empty: { alignItems: 'center', paddingTop: 48, gap: Spacing.md, paddingHorizontal: Spacing.lg },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    marginTop: 8, backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  permBtnText: { color: Colors.bg, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
  settingsBtn: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  settingsBtnText: { color: Colors.text, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
