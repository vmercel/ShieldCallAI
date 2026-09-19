/**
 * database.types — Supabase Database type for the app's typed client.
 *
 * Row shapes mirror the interfaces the services already use (the app's own
 * expected schema). Tables created by SQL migrations in supabase/migrations/
 * match those migrations; the remaining tables were created via the Supabase
 * dashboard and their columns are exactly the fields the services read/write.
 * If the live schema gains a column, add it here.
 */
import type { CallRecord } from './callRecordsService';
import type { CommunityThreat } from './communityThreatsService';
import type { BlockedNumber } from './blockedNumbersService';

/**
 * Interfaces lack implicit index signatures, so they are not assignable to
 * GenericTable's `Record<string, unknown>` rows (and a Database whose schema
 * does not extend GenericSchema collapses every table to `never`). The
 * homomorphic mapped type below preserves the exact row shape while adding
 * the index signature.
 */
type RowOf<T> = { [K in keyof T]: T[K] };

/** Columns the app itself reads/writes on user_profiles (see contexts/AuthContext.tsx, services/permissionsService.ts). */
export interface UserProfileRow {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  persona_name: string;
  ghost_mode_enabled: boolean;
  plan: string;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
}

export interface AnalyticsEventRow {
  id: string;
  user_id: string;
  event_name: string;
  props: Record<string, unknown>;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      call_records: {
        Row: RowOf<CallRecord>;
        Insert: Omit<CallRecord, 'id' | 'created_at'>;
        Update: Partial<CallRecord>;
        Relationships: [];
      };
      community_threats: {
        Row: RowOf<CommunityThreat>;
        Insert: Partial<CommunityThreat>;
        Update: Partial<CommunityThreat>;
        Relationships: [];
      };
      blocked_numbers: {
        Row: RowOf<BlockedNumber>;
        Insert: Omit<BlockedNumber, 'id' | 'blocked_at'>;
        Update: Partial<BlockedNumber>;
        Relationships: [];
      };
      user_profiles: {
        Row: RowOf<UserProfileRow>;
        Insert: Partial<UserProfileRow> & { id: string };
        Update: Partial<UserProfileRow>;
        Relationships: [];
      };
      profiles: {
        Row: RowOf<ProfileRow>;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      analytics_events: {
        Row: RowOf<AnalyticsEventRow>;
        Insert: Omit<AnalyticsEventRow, 'id'>;
        Update: Partial<AnalyticsEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
