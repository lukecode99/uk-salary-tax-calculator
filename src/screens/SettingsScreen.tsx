import React from 'react';
import {
  View, Text, Switch, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { AppSettings } from '../types';
import { StudentLoanPlan, AgeGroup } from '../engine/taxEngine';
import { colors, spacing, radius, font } from '../theme';
import { AdBanner } from '../components/AdBanner';

interface Props {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}

function SegmentControl<T extends string>({
  options, value, onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={seg.container}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[seg.btn, value === o.value && seg.btnActive]}
          onPress={() => onChange(o.value)}
          activeOpacity={0.7}
        >
          <Text style={[seg.label, value === o.value && seg.labelActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    padding: 3,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  btnActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  label: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  labelActive: { color: colors.primary, fontWeight: '600' },
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

function NumericInput({
  value, onChange, suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const [text, setText] = React.useState(String(value));
  return (
    <View style={styles.numericContainer}>
      <TextInput
        style={styles.numericInput}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={(t) => {
          setText(t);
          const n = parseFloat(t);
          if (!isNaN(n)) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
      {suffix && <Text style={styles.suffix}>{suffix}</Text>}
    </View>
  );
}

const AGE_OPTIONS: { label: string; value: AgeGroup }[] = [
  { label: '< 65', value: 'under65' },
  { label: '65–74', value: '65to74' },
  { label: '75+', value: 'over75' },
];

const LOAN_OPTIONS: { label: string; value: StudentLoanPlan }[] = [
  { label: 'None', value: 'none' },
  { label: 'Plan 1', value: 'plan1' },
  { label: 'Plan 2', value: 'plan2' },
  { label: 'Plan 4', value: 'plan4' },
  { label: 'Plan 5', value: 'plan5' },
  { label: 'PG', value: 'postgrad' },
];

export function SettingsScreen({ settings, onChange }: Props) {
  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Row label="Hours per week">
            <NumericInput
              value={settings.hoursPerWeek}
              onChange={(v) => set('hoursPerWeek', v)}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Days per week">
            <NumericInput
              value={settings.daysPerWeek}
              onChange={(v) => set('daysPerWeek', v)}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Pension contribution">
            <NumericInput
              value={settings.pensionPercent}
              onChange={(v) => set('pensionPercent', v)}
              suffix="%"
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Scottish tax rates">
            <Switch
              value={settings.scottishRates}
              onValueChange={(v) => set('scottishRates', v)}
              trackColor={{ true: colors.primary }}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="National Insurance">
            <Switch
              value={settings.payNI}
              onValueChange={(v) => set('payNI', v)}
              trackColor={{ true: colors.primary }}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Age group">
            <SegmentControl options={AGE_OPTIONS} value={settings.ageGroup} onChange={(v) => set('ageGroup', v)} />
          </Row>
          <View style={styles.divider} />
          <Row label="Student loan">
            <SegmentControl options={LOAN_OPTIONS} value={settings.studentLoan} onChange={(v) => set('studentLoan', v)} />
          </Row>
        </View>
      </ScrollView>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: {
    fontSize: font.sizes.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowLabel: { fontSize: font.sizes.md, color: colors.text, flex: 1 },
  rowControl: { flexShrink: 0, maxWidth: 200 },
  divider: { height: 1, backgroundColor: colors.border },
  numericContainer: { flexDirection: 'row', alignItems: 'center' },
  numericInput: {
    backgroundColor: colors.text,
    color: '#FFFFFF',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 80,
  },
  suffix: { color: colors.textSecondary, fontSize: font.sizes.md, marginLeft: spacing.xs },
});
