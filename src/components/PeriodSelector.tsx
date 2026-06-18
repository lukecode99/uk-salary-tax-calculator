import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
          onPress={() => onChange(p.value)}
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
    backgroundColor: colors.border,
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
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: font.sizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
