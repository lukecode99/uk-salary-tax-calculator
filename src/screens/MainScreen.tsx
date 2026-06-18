import React, { useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { calculate, toPeriodResult, TaxResult, Period } from '../engine/taxEngine';
import { PeriodSelector } from '../components/PeriodSelector';
import { ResultRow, formatCurrency } from '../components/ResultRow';
import { AdBanner } from '../components/AdBanner';
import { AppSettings, PensionMode } from '../types';
import { colors, spacing, radius, font } from '../theme';

interface Props {
  newSalary: string;
  setNewSalary: (v: string) => void;
  oldSalary: string;
  setOldSalary: (v: string) => void;
  inputPeriod: Period;
  setInputPeriod: (p: Period) => void;
  settings: AppSettings;
}

function toAnnual(value: number, period: Period, hours: number, days: number): number {
  const W = 52;
  switch (period) {
    case 'annual': return value;
    case 'monthly': return value * 12;
    case 'weekly': return value * W;
    case 'daily': return value * W * days;
    case 'hourly': return value * W * hours;
  }
}

function pensionAnnual(grossSalary: number, mode: PensionMode, value: number): number {
  return mode === 'percent' ? grossSalary * (value / 100) : value;
}

export function MainScreen({
  newSalary, setNewSalary, oldSalary, setOldSalary,
  inputPeriod, setInputPeriod, settings,
}: Props) {
  const [resultPeriod, setResultPeriod] = React.useState<Period>('monthly');
  const [showPension, setShowPension] = React.useState(false);

  const newAnnual = useMemo(() => {
    const v = parseFloat(newSalary.replace(/,/g, ''));
    if (isNaN(v) || v < 0) return null;
    return toAnnual(v, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek);
  }, [newSalary, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek]);

  const oldAnnual = useMemo(() => {
    const v = parseFloat(oldSalary.replace(/,/g, ''));
    if (isNaN(v) || v < 0) return null;
    return toAnnual(v, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek);
  }, [oldSalary, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek]);

  function getPayeContrib(annualGross: number): number {
    const p = settings.pension;
    if (!p.payeEnabled) return 0;
    return pensionAnnual(annualGross, p.payeEmployeeMode, p.payeEmployeeValue);
  }

  const newResult = useMemo(() => {
    if (newAnnual === null) return null;
    const annual = calculate({
      grossSalary: newAnnual,
      payeContrib: getPayeContrib(newAnnual),
      scottishRates: settings.scottishRates,
      studentLoan: settings.studentLoan,
      payNI: settings.payNI,
      ageGroup: settings.ageGroup,
      hoursPerWeek: settings.hoursPerWeek,
      daysPerWeek: settings.daysPerWeek,
    });
    return toPeriodResult(annual, settings.hoursPerWeek, settings.daysPerWeek);
  }, [newAnnual, settings]);

  const oldResult = useMemo(() => {
    if (oldAnnual === null) return null;
    const annual = calculate({
      grossSalary: oldAnnual,
      payeContrib: getPayeContrib(oldAnnual),
      scottishRates: settings.scottishRates,
      studentLoan: settings.studentLoan,
      payNI: settings.payNI,
      ageGroup: settings.ageGroup,
      hoursPerWeek: settings.hoursPerWeek,
      daysPerWeek: settings.daysPerWeek,
    });
    return toPeriodResult(annual, settings.hoursPerWeek, settings.daysPerWeek);
  }, [oldAnnual, settings]);

  function diff(key: keyof TaxResult): number | null {
    if (!newResult || !oldResult) return null;
    const n = newResult[resultPeriod][key] as number;
    const o = oldResult[resultPeriod][key] as number;
    return n - o;
  }

  const current = newResult?.[resultPeriod];
  const hasOld = !!oldResult;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>UK Salary & Tax{'\n'}Calculator 2026</Text>

          {/* Salary inputs */}
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>New</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={newSalary}
                onChangeText={setNewSalary}
              />
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Old</Text>
              <TextInput
                style={[styles.input, styles.inputAlt]}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                value={oldSalary}
                onChangeText={setOldSalary}
              />
            </View>
            <PeriodSelector value={inputPeriod} onChange={setInputPeriod} />
          </View>

          {/* Results */}
          {current && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Results</Text>
              <PeriodSelector value={resultPeriod} onChange={setResultPeriod} />
              <View style={styles.divider} />

              <ResultRow label="Gross Salary" value={current.grossSalary} bold={!hasOld} />
              {hasOld && (
                <ResultRow label="Gross Change" value={diff('grossSalary')!} bold />
              )}

              {current.pension.employeeContrib > 0 && (
                <>
                  <ResultRow label="Pension" value={current.pension.employeeContrib} />
                  <TouchableOpacity onPress={() => setShowPension(v => !v)} activeOpacity={0.7}>
                    <Text style={styles.expandLink}>
                      {showPension ? '▲ Hide detail' : '▼ Pension detail'}
                    </Text>
                  </TouchableOpacity>
                  {showPension && (
                    <View style={styles.pensionBox}>
                      <ResultRow label="Auto tax saving (20%)" value={current.pension.autoTaxSaving} indent dimmed />
                      {current.pension.selfAssessmentClaim > 0 && (
                        <ResultRow label="Claim via self-assessment" value={current.pension.selfAssessmentClaim} indent dimmed />
                      )}
                      <ResultRow label="Net pension cost" value={current.pension.effectiveCost} indent />
                    </View>
                  )}
                </>
              )}

              <ResultRow label="Taxable Income" value={current.taxableIncome} />
              <ResultRow label="Income Tax" value={current.incomeTax} />
              <ResultRow label="National Insurance" value={current.nationalInsurance} />
              {current.studentLoanRepayment > 0 && (
                <ResultRow label="Student Loan" value={current.studentLoanRepayment} />
              )}

              <View style={styles.divider} />
              <ResultRow
                label={hasOld ? 'Take Home Change' : 'Take Home'}
                value={hasOld ? diff('takeHome')! : current.takeHome}
                bold
                accent
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: {
    fontSize: font.sizes.xl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    lineHeight: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  inputLabel: {
    fontSize: font.sizes.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    width: 30,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.sizes.lg,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 0,
  },
  inputAlt: {
    backgroundColor: '#1E1E1E',
  },
  sectionTitle: {
    fontSize: font.sizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  expandLink: {
    color: colors.primary,
    fontSize: font.sizes.sm,
    paddingVertical: spacing.xs,
  },
  pensionBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
});
