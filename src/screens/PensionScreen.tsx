import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { calculateFullPension, FullPensionResult, Period, calculateAni } from '../engine/taxEngine';
import { AppSettings, PensionSettings, PensionMode, PensionBasis } from '../types';
import { colors, spacing, radius, font } from '../theme';

interface Props {
  annualSalary: number;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}

function formatGBP(v: number): string {
  return '£' + Math.round(v).toLocaleString('en-GB');
}

const MODE_LABELS: Record<PensionMode, string> = {
  percent: '%',
  fixed: '£/yr',
  monthly: '£/mo',
};

function ModeToggle({ mode, onChange }: { mode: PensionMode; onChange: (m: PensionMode) => void }) {
  return (
    <View style={tog.container}>
      {(['percent', 'fixed', 'monthly'] as PensionMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[tog.btn, mode === m && tog.btnActive]}
          onPress={() => onChange(m)}
          activeOpacity={0.8}
        >
          <Text style={[tog.label, mode === m && tog.labelActive]}>
            {MODE_LABELS[m]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tog = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 2, alignSelf: 'flex-start' },
  btn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm - 2 },
  btnActive: { backgroundColor: colors.primary },
  label: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '600' },
  labelActive: { color: '#000' },
});

function BasisToggle({ basis, onChange }: { basis: PensionBasis; onChange: (b: PensionBasis) => void }) {
  const opts: { key: PensionBasis; label: string }[] = [
    { key: 'net', label: 'What you pay' },
    { key: 'gross', label: 'Gross (in pot)' },
  ];
  return (
    <View style={basisTog.container}>
      {opts.map((o) => (
        <TouchableOpacity
          key={o.key}
          style={[basisTog.btn, basis === o.key && basisTog.btnActive]}
          onPress={() => onChange(o.key)}
          activeOpacity={0.8}
        >
          <Text style={[basisTog.label, basis === o.key && basisTog.labelActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const basisTog = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 2, alignSelf: 'flex-start' },
  btn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm - 2 },
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
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      style={[styles.valInput, focused && styles.valInputFocused]}
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(t) => { setText(t); const n = parseFloat(t); if (!isNaN(n) && n >= 0) onChange(n); }}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(String(value)); }}
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
    if (mode === 'percent') return annualSalary === 0 ? 0 : annualSalary * (value / 100);
    if (mode === 'monthly') return value * 12; // £/mo → annual
    return value; // fixed = £/yr
  }

  const payeEmployee = p.payeEnabled ? resolve(p.payeEmployeeMode, p.payeEmployeeValue) : 0;
  const payeEmployer = p.payeEnabled ? resolve(p.payeEmployerMode, p.payeEmployerValue) : 0;
  const privateEntered = p.privateEnabled ? resolve(p.privateMode, p.privateValue) : 0;
  // The engine expects a gross contribution. If the user entered what leaves
  // their take-home ('net'), gross it up by basic-rate relief (net / 0.8).
  const privateGross = p.privateBasis === 'net' ? privateEntered / 0.8 : privateEntered;

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

  // Adjusted net income for the £100k childcare cliff-edge. The pension that
  // reduces ANI = workplace (net-pay) employee contributions + the gross of the
  // relief-at-source private contribution.
  const ani = useMemo(
    () => calculateAni(annualSalary, payeEmployee + privateGross),
    [annualSalary, payeEmployee, privateGross],
  );

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
                <ModeToggle mode={p.payeEmployeeMode} onChange={(m) => updatePension({ payeEmployeeMode: m })} />
                <View style={styles.inputRow}>
                  <ValueInput mode={p.payeEmployeeMode} value={p.payeEmployeeValue} onChange={(v) => updatePension({ payeEmployeeValue: v })} />
                  {hasSalary && (
                    <Text style={styles.resolvedAmount}>{formatGBP(payeEmployee)}/yr</Text>
                  )}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputGroupLabel}>Employer contribution</Text>
                <ModeToggle mode={p.payeEmployerMode} onChange={(m) => updatePension({ payeEmployerMode: m })} />
                <View style={styles.inputRow}>
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
                <Text style={styles.inputGroupLabel}>Contribution basis</Text>
                <BasisToggle basis={p.privateBasis} onChange={(b) => updatePension({ privateBasis: b })} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputGroupLabel}>
                  {p.privateBasis === 'net' ? 'Amount you pay in' : 'Gross contribution'}
                </Text>
                <ModeToggle mode={p.privateMode} onChange={(m) => updatePension({ privateMode: m })} />
                <View style={styles.inputRow}>
                  <ValueInput mode={p.privateMode} value={p.privateValue} onChange={(v) => updatePension({ privateValue: v })} />
                  {hasSalary && (
                    <Text style={styles.resolvedAmount}>{formatGBP(privateEntered)}/yr</Text>
                  )}
                </View>
                {hasSalary && privateGross > 0 && (
                  <Text style={styles.basisNote}>
                    {p.privateBasis === 'net'
                      ? `→ ${formatGBP(privateGross)}/yr lands in your pension (after 20% basic-rate relief)`
                      : `→ you pay ${formatGBP(privateGross * 0.8)}/yr; HMRC adds the other ${formatGBP(privateGross * 0.2)}`}
                  </Text>
                )}
              </View>

              {hasSalary && privateGross > 0 && (
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setShowPrivateDetail(v => !v); }} activeOpacity={0.7}>
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

        {/* Adjusted Net Income — childcare £100k cliff-edge */}
        {hasSalary && (
          <View style={styles.card}>
            <SectionHeader title="Adjusted Net Income" />
            <Text style={styles.aniSubtitle}>
              The £100,000 cliff for Tax-Free Childcare &amp; 15/30 funded hours — tested per parent on adjusted net income, not gross salary.
            </Text>

            <Text style={[styles.aniValue, ani.isOver ? styles.aniOver : styles.aniUnder]}>
              {formatGBP(ani.adjustedNetIncome)}
            </Text>
            <Text style={styles.aniWorking}>
              {formatGBP(ani.grossSalary)} salary − {formatGBP(ani.pensionDeduction)} pension
            </Text>

            {!ani.isOver ? (
              <View style={styles.aniCalloutGood}>
                <Text style={styles.aniCalloutGoodText}>
                  ✓ Under £100k — childcare support kept. {formatGBP(ani.headroom)} of headroom before the cliff.
                </Text>
              </View>
            ) : (
              <View style={styles.aniCalloutBad}>
                <Text style={styles.aniCalloutBadText}>
                  ✗ {formatGBP(ani.overBy)} over £100k — all Tax-Free Childcare and funded hours lost.
                </Text>
                <Text style={styles.aniFixLabel}>
                  To get back under: add {formatGBP(ani.grossPensionToThreshold)} gross pension
                  {' '}(you pay {formatGBP(ani.netPensionToThreshold)} into a relief-at-source SIPP),
                  {' '}or salary-sacrifice {formatGBP(ani.overBy)}.
                </Text>
              </View>
            )}

            <Text style={styles.aniNote}>
              Salary-only estimate from the two pension figures above. Real ANI also adds taxable benefits, savings interest, dividends and rental profit, and subtracts Gift Aid (grossed up ÷0.8).
            </Text>
          </View>
        )}

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
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  valInputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  resolvedAmount: {
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    minWidth: 72,
    textAlign: 'right',
  },
  freeTag: { color: colors.primary, fontWeight: '600' },
  freeNote: { fontSize: font.sizes.xs, color: colors.primary, marginTop: 2 },
  basisNote: { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 4 },
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
  aniSubtitle: { fontSize: font.sizes.xs, color: colors.textSecondary, lineHeight: 16 },
  aniValue: { fontSize: 40, fontWeight: '800', letterSpacing: -1, marginTop: spacing.xs },
  aniUnder: { color: colors.primary },
  aniOver: { color: '#FF5252' },
  aniWorking: { fontSize: font.sizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  aniCalloutGood: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  aniCalloutGoodText: { fontSize: font.sizes.sm, color: colors.primary, fontWeight: '600', lineHeight: 18 },
  aniCalloutBad: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  aniCalloutBadText: { fontSize: font.sizes.sm, color: '#FF5252', fontWeight: '700', lineHeight: 18 },
  aniFixLabel: { fontSize: font.sizes.sm, color: colors.text, lineHeight: 18 },
  aniNote: { fontSize: font.sizes.xs, color: colors.textSecondary, lineHeight: 16, marginTop: spacing.xs },
});
