import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { MOCK_CALLS, CallRecord, ThreatLevel } from '../../constants/mockData';
import { ThreatService } from '../../services/threatService';

type Filter = 'all' | 'danger' | 'warning' | 'safe';
type Direction = 'all' | 'inbound' | 'outbound';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'danger', label: 'High Risk' },
  { key: 'warning', label: 'Suspicious' },
  { key: 'safe', label: 'Safe' },
];

// Assign direction deterministically from id
function getDirection(call: CallRecord): 'inbound' | 'outbound' {
  return parseInt(call.id) % 2 === 0 ? 'outbound' : 'inbound';
}

function formatTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Simulate incoming call scenarios for demo
const DEMO_INCOMING = [
  { label: 'IRS Scam', number: '+1 (202) 555-0147', name: 'Unknown Caller' },
  { label: 'Doctor\'s Office', number: '+1 (415) 555-0230', name: 'Dr. Nguyen' },
  { label: 'Unknown VoIP', number: '+1 (800) 555-0982', name: 'Unknown Caller' },
];

export default function CallsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [direction, setDirection] = useState<Direction>('all');
  const [search, setSearch] = useState('');
  const [showIncomingDemo, setShowIncomingDemo] = useState(false);

  const filtered = MOCK_CALLS.filter(c => {
    const dir = getDirection(c);
    const matchFilter = filter === 'all' || c.threatLevel === filter;
    const matchDir = direction === 'all' || dir === direction;
    const matchSearch = !search ||
      c.callerName.toLowerCase().includes(search.toLowerCase()) ||
      c.callerNumber.includes(search) ||
      (c.scamType || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchDir && matchSearch;
  });

  const renderItem = ({ item }: { item: CallRecord }) => {
    const color = ThreatService.getThreatColor(item.threatLevel);
    const dir = getDirection(item);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/call-detail', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        {/* Direction indicator */}
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, { borderColor: color }]}>
            <MaterialIcons
              name={item.ghostHandled ? 'hearing' : item.threatLevel === 'danger' ? 'warning' : 'person'}
              size={22}
              color={color}
            />
          </View>
          <View style={[styles.dirTag, dir === 'outbound' ? styles.outTag : styles.inTag]}>
            <MaterialIcons
              name={dir === 'outbound' ? 'call-made' : 'call-received'}
              size={10}
              color={dir === 'outbound' ? Colors.primary : Colors.safe}
            />
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Text style={styles.callerName} numberOfLines={1}>{item.callerName}</Text>
            <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
          </View>
          <Text style={styles.callerNumber}>{item.callerNumber}</Text>
          <View style={styles.cardTagRow}>
            {item.ghostHandled && (
              <View style={styles.ghostTag}>
                <MaterialIcons name="hearing" size={10} color={Colors.primary} />
                <Text style={styles.ghostTagText}>Ghost</Text>
              </View>
            )}
            {item.scamType ? (
              <View style={[styles.scamTag, { backgroundColor: color + '22', borderColor: color + '55' }]}>
                <Text style={[styles.scamTagText, { color }]}>{item.scamType}</Text>
              </View>
            ) : null}
            <Text style={styles.durationText}>{formatDur(item.duration)}</Text>
          </View>
          <Text style={styles.summaryText} numberOfLines={2}>{item.summary}</Text>
        </View>
        <View style={[styles.threatIndicator, { backgroundColor: color }]}>
          <Text style={styles.threatScore}>{item.threatScore}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Call History</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.demoBtn}
            onPress={() => setShowIncomingDemo(s => !s)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="phone-in-talk" size={14} color={Colors.safe} />
            <Text style={styles.demoBtnText}>Simulate Incoming</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Incoming Call Demo Panel */}
      {showIncomingDemo && (
        <View style={styles.demoPanel}>
          <Text style={styles.demoPanelTitle}>Simulate an Incoming Call</Text>
          <View style={styles.demoScenarios}>
            {DEMO_INCOMING.map(s => (
              <TouchableOpacity
                key={s.number}
                style={styles.demoScenario}
                onPress={() => {
                  setShowIncomingDemo(false);
                  router.push({
                    pathname: '/incoming-call',
                    params: { callerNumber: s.number, callerName: s.name },
                  });
                }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="call" size={14} color={Colors.primary} />
                <Text style={styles.demoScenarioLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search calls, numbers, scam types..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Direction + Threat Filters */}
      <View style={styles.filtersBlock}>
        <View style={styles.filterRow}>
          {['all', 'inbound', 'outbound'].map(d => (
            <TouchableOpacity
              key={d}
              onPress={() => setDirection(d as Direction)}
              style={[styles.filterChip, direction === d && styles.filterChipActive]}
              activeOpacity={0.8}
            >
              {d !== 'all' && (
                <MaterialIcons
                  name={d === 'inbound' ? 'call-received' : 'call-made'}
                  size={11}
                  color={direction === d ? Colors.primary : Colors.textMuted}
                />
              )}
              <Text style={[styles.filterText, direction === d && styles.filterTextActive]}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="phone-missed" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No calls match your filter</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text },
  headerRight: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.safeGlow, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.safe + '44',
  },
  demoBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.safe },

  demoPanel: {
    marginHorizontal: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, marginBottom: Spacing.sm, gap: Spacing.sm,
  },
  demoPanelTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  demoScenarios: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  demoScenario: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  demoScenarioLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.primary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false },

  filtersBlock: { paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  filterRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  filterTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  list: { paddingHorizontal: Spacing.md },
  card: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderSubtle,
    gap: Spacing.sm,
  },
  cardLeft: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
  dirTag: {
    position: 'absolute', bottom: -2, right: -2,
    width: 17, height: 17, borderRadius: 8.5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bg,
  },
  inTag: { backgroundColor: Colors.safeGlow },
  outTag: { backgroundColor: Colors.primaryGlow },
  cardBody: { flex: 1, gap: 3 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  callerName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  timeText: { fontSize: FontSize.xs, color: Colors.textMuted },
  callerNumber: { fontSize: FontSize.xs, color: Colors.textSecondary },
  cardTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  ghostTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border,
  },
  ghostTagText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.primary },
  scamTag: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  scamTagText: { fontSize: 10, fontWeight: FontWeight.bold },
  durationText: { fontSize: FontSize.xs, color: Colors.textMuted },
  summaryText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  threatIndicator: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  threatScore: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
