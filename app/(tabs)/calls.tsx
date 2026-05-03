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

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'danger', label: 'High Risk' },
  { key: 'warning', label: 'Suspicious' },
  { key: 'safe', label: 'Safe' },
];

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

export default function CallsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = MOCK_CALLS.filter(c => {
    const matchFilter = filter === 'all' || c.threatLevel === filter;
    const matchSearch = !search || c.callerName.toLowerCase().includes(search.toLowerCase()) ||
      c.callerNumber.includes(search) || (c.scamType || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const renderItem = ({ item }: { item: CallRecord }) => {
    const color = ThreatService.getThreatColor(item.threatLevel);
    const label = ThreatService.getThreatLabel(item.threatLevel);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/call-detail', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        <View style={[styles.avatar, { borderColor: color }]}>
          <MaterialIcons
            name={item.ghostHandled ? 'hearing' : item.threatLevel === 'danger' ? 'warning' : 'person'}
            size={22}
            color={color}
          />
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
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{MOCK_CALLS.length} calls</Text>
        </View>
      </View>

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

      {/* Filters */}
      <View style={styles.filterOuter}>
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
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, color: Colors.text, flex: 1 },
  headerBadge: {
    backgroundColor: Colors.bgCard, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
  },
  headerBadgeText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md, marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, includeFontPadding: false },
  filterOuter: { height: 48, marginBottom: Spacing.md },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full,
    backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryGlow, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  filterTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  list: { paddingHorizontal: Spacing.md },
  card: {
    flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.borderSubtle,
    gap: Spacing.sm,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    backgroundColor: Colors.bgSurface, alignItems: 'center', justifyContent: 'center',
  },
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
  scamTag: {
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1,
  },
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
