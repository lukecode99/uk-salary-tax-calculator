import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Period } from '../engine/taxEngine';
import { colors, spacing, radius, font } from '../theme';

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Annual', value: 'annual' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Hourly', value: 'hourly' },
];

interface Props {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.value}
          style={[styles.pill, value === p.value && styles.pillActive]}
          onPress={() => { Haptics.selectionAsync(); onChange(p.value); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, value === p.value && styles.labelActive]}>
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: font.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: '#000000',
    fontWeight: '700',
  },
});
