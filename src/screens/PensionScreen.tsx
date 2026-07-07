import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { calculateFullPension, FullPensionResult, Period } from '../engine/taxEngine';
import { AppSettings, PensionSettings, PensionMode } from '../types';
import { colors, spacing, radius, font } from '../theme';

interface Props {
  annualSalary: number;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}

function formatGBP(v: number): string {
  return '£' + Math.round(v).toLocaleString('en-GB');
}

function ModeToggle({ mode, onChange }: { mode: PensionMode; onChange: (m: PensionMode) => void }) {
  return (
    <View style={tog.container}>
      {(['percent', 'fixed'] as PensionMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[tog.btn, mode === m && tog.btnActive]}
          onPress={() => onChange(m)}
          activeOpacity={0.8}
        >
          <Text style={[tog.label, mode === m && tog.labelActive]}>
            {m === 'percent' ? '%' : '£'}
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

function ValueInput({
  mode, value, onChange,
}: {
  mode: PensionMode; value: number; onChange: (v: number) => void;
}) {
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

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function ResultLine({
  label, value, highlight, dimmed,
}: {
  label: string; value: number; highlight?: boolean; dimmed?: boolean;
}) {
  return (
    <View style={styles.resultLine}>
      <Text style={[styles.resultLabel, dimmed && styles.dimmed]}>{label}</Text>
      <Text style={[styles.resultValue, highlight && styles.highlight, dimmed && styles.dimmed]}>
        {formatGBP(value)}
      </Text>
    </View>
  );
}

export function PensionScreen({ annualSalary, settings, onSettingsChange }: Props) {
  const p = settings.pension;
  const [showPrivateDetail, setShowPrivateDetail] = useState(false);

  function updatePension(patch: Partial<PensionSettings>) {
    onSettingsChange({ ...settings, pension: { ...p, ...patch } });
  }

  function resolve(mode: PensionMode, value: number): number {
    if (annualSalary === 0) return 0;
    return mode === 'percent' ? annualSalary * (value / 100) : value;
  }

  const payeEmployee = p.payeEnabled ? resolve(p.payeEmployeeMode, p.payeEmployeeValue) : 0;
  const payeEmployer = p.payeEnabled ? resolve(p.payeEmployerMode, p.payeEmployerValue) : 0;
  const privateGross = p.privateEnabled ? resolve(p.privateMode, p.privateValue) : 0;

  const result: FullPensionResult | null = useMemo(() => {
    if (annualSalary <= 0) return null;
    return calculateFullPension(
      annualSalary,
      payeEmployee,
      payeEmployer,
      privateGross,
      settings.scottishRates,
      settings.taxYear,
    );
  }, [annualSalary, payeEmployee, payeEmployer, privateGross, settings.scottishRates, settings.taxYear]);

  const hasSalary = annualSalary > 0;
  const hasSaClaim = result && (result.privateSaClaim > 0 || result.payeSaClaim > 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Pension Calculator</Text>

        {!hasSalary && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Enter a salary in the Calculator tab first.</Text>
          </View>
        )}

        {/* Combined Pension Card */}
        <View style={styles.card}>
          {/* Workplace Pension subsection */}
          <View style={styles.cardHeader}>
            <SectionHeader title="PAYE / Workplace Pension" />
            <Switch
              value={p.payeEnabled}
              onValueChange={(v) => updatePension({ payeEnabled: v })}
              trackColor={{ true: colors.primary }}
              thumbColor={p.payeEnabled ? '#000' : colors.textSecondary}
            />
          </View>

          {p.payeEnabled && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputGroupLabel}>Your contribution</Text>
                <View style={styles.inputRow}>
                  <ModeToggle mode={p.payeEmployeeMode} onChange={(m) => updatePension({ payeEmployeeMode: m })} />
                  <ValueInput mode={p.payeEmployeeMode} value={p.payeEmployeeValue} onChange={(v) => updatePension({ payeEmployeeValue: v })} />
                  {hasSalary && (
                    <Text style={styles.resolvedAmount}>{formatGBP(payeEmployee)}/yr</Text>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputGroupLabel}>Employer contribution</Text>
                <View style={styles.inputRow}>
                  <ModeToggle mode={p.payeEmployerMode} onChange={(m) => updatePension({ payeEmployerMode: m })} />
                  <ValueInput mode={p.payeEmployerMode} value={p.payeEmployerValue} onChange={(v) => updatePension({ payeEmployerValue: v })} />
                  {hasSalary && (
                    <Text style={[styles.resolvedAmount, styles.freeTag]}>{formatGBP(payeEmployer)}/yr</Text>
                  )}
                </View>
                {hasSalary && payeEmployer > 0 && (
                  <Text style={styles.freeNote}>Free money from employer — goes straight into your pension</Text>
                )}
              </View>
            </>
          )}

          {/* Divider between sections */}
          <View style={styles.sectionDivider} />

          {/* Private Pension subsection */}
          <View style={styles.cardHeader}>
            <SectionHeader title="Private Pension" />
            <Switch
              value={p.privateEnabled}
              onValueChange={(v) => { updatePension({ privateEnabled: v }); if (!v) setShowPrivateDetail(false); }}
              trackColor={{ true: colors.primary }}
              thumbColor={p.privateEnabled ? '#000' : colors.textSecondary}
            />
          </View>

          {p.privateEnabled && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputGroupLabel}>Gross contribution</Text>
                <View style={styles.inputRow}>
                  <ModeToggle mode={p.privateMode} onChange={(m) => updatePension({ privateMode: m })} />
                  <ValueInput mode={p.privateMode} value={p.privateValue} onChange={(v) => updatePension({ privateValue: v })} />
                  {hasSalary && (
                    <Text style={styles.resolvedAmount}>{formatGBP(privateGross)}/yr</Text>
                  )}
                </View>
              </View>

              {hasSalary && privateGross > 0 && (
                <TouchableOpacity onPress={() => setShowPrivateDetail(v => !v)} activeOpacity={0.7}>
                  <Text style={styles.expandLink}>
                    {showPrivateDetail ? '▲ Hide detail' : '▼ Show detail'}
                  </Text>
                </TouchableOpacity>
              )}

              {hasSalary && result && privateGross > 0 && showPrivateDetail && (
                <View style={styles.reliefBox}>
                  <ResultLine label="You physically pay" value={result.privateYouPay} dimmed />
                  <ResultLine label="HMRC adds (20% basic relief)" value={result.privateBasicRelief} dimmed />
                  <ResultLine label="Total going in" value={result.privateGross} />
                  {result.privateSaClaim > 0 && (
                    <ResultLine label="Self-assessment claim" value={result.privateSaClaim} highlight />
                  )}
                  {result.privateSaClaim === 0 && (
                    <Text style={styles.note}>Basic rate taxpayer — no extra SA claim needed.</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Summary */}
        {hasSalary && result && (payeEmployee + payeEmployer + privateGross > 0) && (
          <View style={styles.card}>
            <SectionHeader title="Annual Summary" />
            <View style={styles.summaryDivider} />

            <ResultLine label="Your PAYE contribution" value={result.payeEmployee} />
            {result.payeEmployer > 0 && (
              <ResultLine label="Employer adds (free!)" value={result.payeEmployer} />
            )}
            {result.privateGross > 0 && (
              <ResultLine label="Private pension gross" value={result.privateGross} />
            )}

            <View style={styles.summaryDivider} />
            <ResultLine label="Total into pension pot" value={result.totalPot} highlight />

            <View style={styles.summaryDivider} />
            {result.payeAutoSaving > 0 && (
              <ResultLine label="Income tax saved (PAYE)" value={result.payeAutoSaving} dimmed />
            )}
            {result.privateBasicRelief > 0 && (
              <ResultLine label="HMRC basic relief (private)" value={result.privateBasicRelief} dimmed />
            )}
            {hasSaClaim && (
              <ResultLine label="Extra via self-assessment" value={(result.privateSaClaim || 0) + (result.payeSaClaim || 0)} dimmed />
            )}

            <View style={styles.summaryDivider} />
            <ResultLine label="Total tax saving" value={result.totalTaxSaving} highlight />
            <ResultLine label="Net cost to you" value={result.netCostEmployee} />

            {hasSaClaim && (
              <View style={styles.saCallout}>
                <Text style={styles.saCalloutText}>
                  You can claim {formatGBP((result.privateSaClaim || 0) + (result.payeSaClaim || 0))} back via Self Assessment as a higher rate taxpayer.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  sectionHeader: {
    fontSize: font.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  inputGroup: { gap: spacing.xs },
  inputGroupLabel: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
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
  freeTag: { color: colors.primary, fontWeight: '600' },
  freeNote: { fontSize: font.sizes.xs, color: colors.primary, marginTop: 2 },
  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  expandLink: {
    color: colors.primary,
    fontSize: font.sizes.sm,
    paddingVertical: spacing.xs,
  },
  reliefBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  resultLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  resultLabel: { fontSize: font.sizes.sm, color: colors.text, flex: 1 },
  resultValue: { fontSize: font.sizes.sm, color: colors.text, fontWeight: '600' },
  highlight: { color: colors.primary, fontWeight: '700', fontSize: font.sizes.md },
  dimmed: { color: colors.textSecondary },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  note: { fontSize: font.sizes.xs, color: colors.textSecondary },
  saCallout: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  saCalloutText: { fontSize: font.sizes.sm, color: colors.primary, fontWeight: '600' },
});
