import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { calculate, toPeriodResult, TaxResult, Period } from '../engine/taxEngine';
import { PeriodSelector } from '../components/PeriodSelector';
import { ResultRow, formatCurrency } from '../components/ResultRow';
import { AdBanner } from '../components/AdBanner';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { colors, spacing, radius, font } from '../theme';

interface Props {
  settings: AppSettings;
}

function toAnnual(value: number, period: Period, hours: number, days: number): number {
  const WEEKS = 52;
  switch (period) {
    case 'annual': return value;
    case 'monthly': return value * 12;
    case 'weekly': return value * WEEKS;
    case 'daily': return value * WEEKS * days;
    case 'hourly': return value * WEEKS * hours;
  }
}

export function MainScreen({ settings }: Props) {
  const [newSalary, setNewSalary] = useState('');
  const [oldSalary, setOldSalary] = useState('');
  const [inputPeriod, setInputPeriod] = useState<Period>('annual');
  const [resultPeriod, setResultPeriod] = useState<Period>('monthly');
  const [showPension, setShowPension] = useState(false);

  const newAnnual = useMemo(() => {
    const v = parseFloat(newSalary.replace(/,/g, ''));
    if (isNaN(v) || v < 0) return null;
    return toAnnual(v, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek);
  }, [newSalary, inputPeriod, settings]);

  const oldAnnual = useMemo(() => {
    const v = parseFloat(oldSalary.replace(/,/g, ''));
    if (isNaN(v) || v < 0) return null;
    return toAnnual(v, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek);
  }, [oldSalary, inputPeriod, settings]);

  const newResult = useMemo(() => {
    if (newAnnual === null) return null;
    const annual = calculate({
      grossSalary: newAnnual,
      pensionPercent: settings.pensionPercent,
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
      pensionPercent: settings.pensionPercent,
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Title */}
          <Text style={styles.title}>UK Salary & Tax Calculator 2026</Text>

          {/* Salary inputs */}
          <View style={styles.card}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>New</Text>
              <TextInput
                style={styles.salaryInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={newSalary}
                onChangeText={setNewSalary}
              />
            </View>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Old</Text>
              <TextInput
                style={[styles.salaryInput, styles.salaryInputAlt]}
                keyboardType="decimal-pad"
                placeholder="Optional"
                placeholderTextColor={colors.textSecondary}
                value={oldSalary}
                onChangeText={setOldSalary}
              />
            </View>
            <View style={styles.periodRow}>
              <PeriodSelector value={inputPeriod} onChange={setInputPeriod} />
            </View>
          </View>

          {/* Results */}
          {current && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Results</Text>
              <PeriodSelector value={resultPeriod} onChange={setResultPeriod} />

              <View style={styles.divider} />

              <ResultRow
                label="Gross Salary"
                value={current.grossSalary}
                bold={!oldResult}
              />
              {oldResult && (
                <ResultRow
                  label="Gross Salary Change"
                  value={diff('grossSalary')!}
                  bold
                />
              )}

              <ResultRow label="Pension" value={current.pension.grossContribution} />

              {/* Pension detail toggle */}
              <TouchableOpacity onPress={() => setShowPension(v => !v)} activeOpacity={0.7}>
                <Text style={styles.expandLink}>{showPension ? '▲ Hide pension detail' : '▼ Pension detail'}</Text>
              </TouchableOpacity>

              {showPension && (
                <View style={styles.pensionBox}>
                  <ResultRow
                    label="Your contribution"
                    value={current.pension.employeeCost}
                    indent
                    dimmed
                  />
                  <ResultRow
                    label="Auto tax relief (20%)"
                    value={current.pension.autoRelief}
                    indent
                    dimmed
                  />
                  {current.pension.selfAssessmentClaim > 0 && (
                    <ResultRow
                      label="Claim via self-assessment"
                      value={current.pension.selfAssessmentClaim}
                      indent
                      dimmed
                    />
                  )}
                  <ResultRow
                    label="Effective pension cost"
                    value={current.pension.effectiveCost}
                    indent
                  />
                </View>
              )}

              <ResultRow label="Taxable Income" value={current.taxableIncome} />
              <ResultRow label="Income Tax" value={current.incomeTax} />
              <ResultRow label="National Insurance" value={current.nationalInsurance} />
              {current.studentLoanRepayment > 0 && (
                <ResultRow label="Student Loan" value={current.studentLoanRepayment} />
              )}

              <View style={styles.divider} />
              <ResultRow
                label="Take Home"
                value={oldResult ? diff('takeHome')! : current.takeHome}
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
    gap: spacing.sm,
  },
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  salaryLabel: {
    fontSize: font.sizes.md,
    color: colors.textSecondary,
    width: 36,
  },
  salaryInput: {
    flex: 1,
    backgroundColor: colors.text,
    color: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.sizes.lg,
    fontWeight: '600',
    textAlign: 'right',
  },
  salaryInputAlt: {
    backgroundColor: '#1E293B',
  },
  periodRow: {
    marginTop: spacing.xs,
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
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
});
