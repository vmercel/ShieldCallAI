/**
 * CALLSHIELD Error Boundary
 * Catches uncaught React render exceptions and shows a recovery screen
 * instead of a blank/crashed app.
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[CALLSHIELD ErrorBoundary]', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="error-outline" size={48} color={Colors.danger} />
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            {this.props.fallbackTitle || 'An unexpected error occurred in this section.'}
          </Text>
          {__DEV__ && this.state.errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText} numberOfLines={4}>{this.state.errorMessage}</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.85}>
            <MaterialIcons name="refresh" size={18} color={Colors.textInverse} />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.dangerGlow, borderWidth: 2, borderColor: Colors.danger + '44',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl, fontWeight: FontWeight.extrabold,
    color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg,
  },
  errorBox: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    width: '100%', marginBottom: Spacing.lg,
  },
  errorText: {
    fontSize: FontSize.xs, color: Colors.danger,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  retryText: {
    fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textInverse,
  },
});

// Needed for __DEV__ and Platform in the styles
import { Platform } from 'react-native';
