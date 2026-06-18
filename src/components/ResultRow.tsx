import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, spacing } from '../theme';

interface Props {
  label: string;
  value: number;
  bold?: boolean;
  accent?: boolean;
  dimmed?: boolean;
  indent?: boolean;
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (value < 0 ? '-' : '') + '£' + formatted;
}

export function ResultRow({ label, value, bold, accent, dimmed, indent }: Props) {
  return (
    <View style={[styles.row, indent && styles.indented]}>
      <Text style={[styles.label, bold && styles.bold, dimmed && styles.dimmed]}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          bold && styles.bold,
          accent && styles.accent,
          dimmed && styles.dimmed,
        ]}
      >
        {formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  indented: {
    paddingLeft: spacing.md,
  },
  label: {
    fontSize: font.sizes.md,
    color: colors.text,
    flex: 1,
  },
  value: {
    fontSize: font.sizes.md,
    color: colors.text,
    textAlign: 'right',
    minWidth: 110,
  },
  bold: {
    fontWeight: '700',
    fontSize: font.sizes.lg,
  },
  accent: {
    color: colors.positive,
  },
  dimmed: {
    color: colors.textSecondary,
    fontSize: font.sizes.sm,
  },
});
