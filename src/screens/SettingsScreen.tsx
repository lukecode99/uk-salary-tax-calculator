import React from 'react';
import {
  View, Text, Switch, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { AppSettings } from '../types';
import { StudentLoanPlan, AgeGroup } from '../engine/taxEngine';
import { TAX_YEARS, TaxYear } from '../engine/taxRates';
import { colors, spacing, radius, font } from '../theme';
import { AdBanner } from '../components/AdBanner';

interface Props {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}

function PillGrid<T extends string>({
  options, value, onChange, columns = 3,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  columns?: number;
}) {
  const rows: { label: string; value: T }[][] = [];
  for (let i = 0; i < options.length; i += columns) {
    rows.push(options.slice(i, i + columns));
  }
  return (
    <View style={{ gap: spacing.xs }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: spacing.xs }}>
          {row.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[pill.btn, value === o.value && pill.btnActive, { flex: 1 }]}
              onPress={() => onChange(o.value)}
              activeOpacity={0.7}
            >
              <Text style={[pill.label, value === o.value && pill.labelActive]} numberOfLines={1}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const pill = StyleSheet.create({
  btn: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  btnActive: {
    backgroundColor: colors.primary,
  },
  label: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  labelActive: { color: '#000000', fontWeight: '700' },
});

function Row({ label, children, column }: { label: string; children: React.ReactNode; column?: boolean }) {
  return (
    <View style={[styles.row, column && styles.rowColumn]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={column ? styles.rowControlFull : styles.rowControl}>{children}</View>
    </View>
  );
}

function NumericInput({
  value, onChange, suffix,
}: {
  value: number; onChange: (v: number) => void; suffix?: string;
}) {
  const [text, setText] = React.useState(String(value));
  return (
    <View style={styles.numRow}>
      <TextInput
        style={styles.numInput}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={(t) => { setText(t); const n = parseFloat(t); if (!isNaN(n)) onChange(n); }}
        onBlur={() => setText(String(value))}
      />
      {suffix && <Text style={styles.suffix}>{suffix}</Text>}
    </View>
  );
}

const AGE_OPTIONS: { label: string; value: AgeGroup }[] = [
  { label: 'Under 66', value: 'under66' },
  { label: '66–74', value: '66to74' },
  { label: '75+', value: 'over75' },
];

const YEAR_OPTIONS: { label: string; value: TaxYear }[] =
  TAX_YEARS.map((y) => ({ label: y, value: y }));

const LOAN_OPTIONS: { label: string; value: StudentLoanPlan }[] = [
  { label: 'None', value: 'none' },
  { label: 'Plan 1', value: 'plan1' },
  { label: 'Plan 2', value: 'plan2' },
  { label: 'Plan 4', value: 'plan4' },
  { label: 'Plan 5', value: 'plan5' },
  { label: 'Postgrad', value: 'postgrad' },
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
          <Row label="Tax year" column>
            <PillGrid
              options={YEAR_OPTIONS}
              value={settings.taxYear}
              onChange={(v) => set('taxYear', v)}
              columns={2}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Hours per week">
            <NumericInput value={settings.hoursPerWeek} onChange={(v) => set('hoursPerWeek', v)} />
          </Row>
          <View style={styles.divider} />
          <Row label="Days per week">
            <NumericInput value={settings.daysPerWeek} onChange={(v) => set('daysPerWeek', v)} />
          </Row>
          <View style={styles.divider} />
          <Row label="Scottish tax rates">
            <Switch
              value={settings.scottishRates}
              onValueChange={(v) => set('scottishRates', v)}
              trackColor={{ true: colors.primary }}
              thumbColor={settings.scottishRates ? '#000' : colors.textSecondary}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Pay National Insurance">
            <Switch
              value={settings.payNI}
              onValueChange={(v) => set('payNI', v)}
              trackColor={{ true: colors.primary }}
              thumbColor={settings.payNI ? '#000' : colors.textSecondary}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Age group" column>
            <PillGrid
              options={AGE_OPTIONS}
              value={settings.ageGroup}
              onChange={(v) => set('ageGroup', v)}
              columns={3}
            />
          </Row>
          <View style={styles.divider} />
          <Row label="Student loan" column>
            <PillGrid
              options={LOAN_OPTIONS}
              value={settings.studentLoan}
              onChange={(v) => set('studentLoan', v)}
              columns={3}
            />
          </Row>
        </View>

        <Text style={styles.note}>
          Pension settings are on the Pension tab. NI stops at State Pension Age (currently 66).
        </Text>
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowLabel: { fontSize: font.sizes.md, color: colors.text, flex: 1 },
  rowControl: { flexShrink: 0 },
  rowControlFull: { width: '100%' },
  divider: { height: 1, backgroundColor: colors.border },
  numRow: { flexDirection: 'row', alignItems: 'center' },
  numInput: {
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 72,
  },
  suffix: { color: colors.textSecondary, fontSize: font.sizes.md, marginLeft: spacing.xs },
  note: {
    fontSize: font.sizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
