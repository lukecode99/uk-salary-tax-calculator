import React from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { AppSettings, SacrificeItem, SacrificeMode, SalaryScrificeSettings } from '../types';
import { AdBanner } from '../components/AdBanner';
import { colors, spacing, radius, font } from '../theme';

interface Props {
  annualSalary: number;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}

function formatGBP(v: number): string {
  return '£' + Math.round(v).toLocaleString('en-GB');
}

function resolveAnnual(mode: SacrificeMode, value: number): number {
  return mode === 'monthly' ? value * 12 : value;
}

function ModeToggle({ mode, onChange }: { mode: SacrificeMode; onChange: (m: SacrificeMode) => void }) {
  return (
    <View style={tog.container}>
      {(['monthly', 'fixed'] as SacrificeMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[tog.btn, mode === m && tog.btnActive]}
          onPress={() => onChange(m)}
          activeOpacity={0.8}
        >
          <Text style={[tog.label, mode === m && tog.labelActive]}>
            {m === 'monthly' ? '£/mo' : '£/yr'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tog = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 2 },
  btn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm - 2 },
  btnActive: { backgroundColor: colors.primary },
  label: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  labelActive: { color: '#000' },
});

function ValueInput({ mode, value, onChange }: { mode: SacrificeMode; value: number; onChange: (v: number) => void }) {
  const [text, setText] = React.useState(String(value));
  return (
    <TextInput
      style={styles.valInput}
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(t) => { setText(t); const n = parseFloat(t); if (!isNaN(n) && n >= 0) onChange(n); }}
      onBlur={() => setText(String(value))}
    />
  );
}

interface SectionProps {
  title: string;
  note?: string;
  item: SacrificeItem;
  annualSalary: number;
  onUpdate: (patch: Partial<SacrificeItem>) => void;
}

function SacrificeSection({ title, note, item, annualSalary, onUpdate }: SectionProps) {
  const annualAmount = item.enabled ? resolveAnnual(item.mode, item.value) : 0;
  const hasSalary = annualSalary > 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Switch
          value={item.enabled}
          onValueChange={(v) => onUpdate({ enabled: v })}
          trackColor={{ true: colors.primary }}
          thumbColor={item.enabled ? '#000' : colors.textSecondary}
        />
      </View>

      {note && <Text style={styles.note}>{note}</Text>}

      {item.enabled && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Amount sacrificed</Text>
            <View style={styles.inputRow}>
              <ModeToggle mode={item.mode} onChange={(m) => onUpdate({ mode: m })} />
              <ValueInput mode={item.mode} value={item.value} onChange={(v) => onUpdate({ value: v })} />
              {hasSalary && annualAmount > 0 && (
                <Text style={styles.resolvedAmount}>{formatGBP(annualAmount)}/yr</Text>
              )}
            </View>
          </View>

          {hasSalary && annualAmount > 0 && (
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Salary sacrificed</Text>
                <Text style={styles.infoValue}>{formatGBP(annualAmount)}/yr</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{formatGBP(annualAmount / 12)}/mo from payslip</Text>
                <Text style={styles.infoLabel}>before tax & NI</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function SalaryScrificeScreen({ annualSalary, settings, onSettingsChange }: Props) {
  const s = settings.sacrifice;

  function update(key: keyof SalaryScrificeSettings, patch: Partial<SacrificeItem>) {
    onSettingsChange({
      ...settings,
      sacrifice: { ...s, [key]: { ...s[key], ...patch } },
    });
  }

  const totalAnnual = (s.car.enabled ? resolveAnnual(s.car.mode, s.car.value) : 0)
    + (s.bike.enabled ? resolveAnnual(s.bike.mode, s.bike.value) : 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Salary Sacrifice</Text>

        {!annualSalary && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Enter a salary in the Calculator tab first.</Text>
          </View>
        )}

        <SacrificeSection
          title="Company Car Scheme"
          note="Reduces gross salary before income tax. Under OpRA rules (2017+), most car schemes don't save employee NI — only electric/ULEV vehicles retain the full benefit."
          item={s.car}
          annualSalary={annualSalary}
          onUpdate={(p) => update('car', p)}
        />

        <SacrificeSection
          title="Cycle to Work"
          note="Saves income tax AND NI. HMRC exempts bike schemes from OpRA rules."
          item={s.bike}
          annualSalary={annualSalary}
          onUpdate={(p) => update('bike', p)}
        />

        {totalAnnual > 0 && annualSalary > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Total</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total sacrificed / yr</Text>
              <Text style={styles.totalValue}>{formatGBP(totalAnnual)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total sacrificed / mo</Text>
              <Text style={styles.totalValue}>{formatGBP(totalAnnual / 12)}</Text>
            </View>
            <Text style={styles.hint}>See Calculator tab for the full impact on your take-home pay.</Text>
          </View>
        )}
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
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: { color: colors.textSecondary, fontSize: font.sizes.md, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: font.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  note: {
    fontSize: font.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  inputGroup: { gap: spacing.xs },
  inputLabel: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  valInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  resolvedAmount: {
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    minWidth: 72,
    textAlign: 'right',
  },
  infoBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: { fontSize: font.sizes.sm, color: colors.textSecondary },
  infoValue: { fontSize: font.sizes.sm, color: colors.text, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: { fontSize: font.sizes.md, color: colors.textSecondary },
  totalValue: { fontSize: font.sizes.md, color: colors.text, fontWeight: '700' },
  hint: { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: spacing.xs },
});
