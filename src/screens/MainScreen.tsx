import React, { useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { calculate, toPeriodResult, TaxResult, Period } from '../engine/taxEngine';
import { PeriodSelector } from '../components/PeriodSelector';
import { ResultRow, formatCurrency } from '../components/ResultRow';
import { AdBanner } from '../components/AdBanner';
import { AppSettings, PensionMode, SacrificeMode } from '../types';
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
  if (mode === 'percent') return grossSalary * (value / 100);
  if (mode === 'monthly') return value * 12;
  return value; // 'fixed' = annual
}

function sacrificeAnnual(mode: SacrificeMode, value: number): number {
  return mode === 'monthly' ? value * 12 : value;
}

function scaleByPeriod(annual: number, period: Period, hours: number, days: number): number {
  const W = 52;
  switch (period) {
    case 'annual': return annual;
    case 'monthly': return annual / 12;
    case 'weekly': return annual / W;
    case 'daily': return annual / (W * days);
    case 'hourly': return annual / (W * hours);
  }
}

export function MainScreen({
  newSalary, setNewSalary, oldSalary, setOldSalary,
  inputPeriod, setInputPeriod, settings,
}: Props) {
  const [resultPeriod, setResultPeriod] = React.useState<Period>('monthly');
  const [showPrivatePensionDetail, setShowPrivatePensionDetail] = React.useState(false);

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

  function getPrivateContrib(annualGross: number): number {
    const p = settings.pension;
    if (!p.privateEnabled) return 0;
    // user enters what they physically pay (net); gross into pot = net / 0.8
    const netAnnual = pensionAnnual(annualGross, p.privateMode, p.privateValue);
    return netAnnual / 0.8;
  }

  function getTotalSacrifice(): number {
    const s = settings.sacrifice;
    const car = s.car.enabled ? sacrificeAnnual(s.car.mode, s.car.value) : 0;
    const bike = s.bike.enabled ? sacrificeAnnual(s.bike.mode, s.bike.value) : 0;
    return car + bike;
  }

  function getCarBiKValue(): number {
    const c = settings.sacrifice.car;
    if (!c.enabled || !c.p11dValue || !c.bikRate) return 0;
    return c.p11dValue * (c.bikRate / 100);
  }

  const newResult = useMemo(() => {
    if (newAnnual === null) return null;
    const annual = calculate({
      grossSalary: newAnnual,
      payeContrib: getPayeContrib(newAnnual),
      privateContrib: getPrivateContrib(newAnnual),
      totalSalaryScrifice: getTotalSacrifice(),
      carBiKValue: getCarBiKValue(),
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
      privateContrib: getPrivateContrib(oldAnnual),
      totalSalaryScrifice: getTotalSacrifice(),
      carBiKValue: getCarBiKValue(),
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

  // Private pension breakdown (for detail box and SA note)
  const privatePensionBreakdown = useMemo(() => {
    if (!current || !current.privatePension || current.privatePension <= 0) return null;
    const grossContrib = current.privatePension;
    const netYouPay = grossContrib * 0.8;
    const basicRelief = grossContrib * 0.2;
    // Determine marginal rate from annual adjusted net income
    const annualAdjustedNet = newResult?.annual.adjustedNetIncome ?? 0;
    const marginalRate = annualAdjustedNet > 125140 ? 0.45 : annualAdjustedNet > 50270 ? 0.40 : 0.20;
    const saClaim = grossContrib * Math.max(0, marginalRate - 0.20);
    const annualSaClaim = (newResult?.annual.privatePension ?? 0) * Math.max(0, marginalRate - 0.20);
    return { grossContrib, netYouPay, basicRelief, saClaim, annualSaClaim };
  }, [current, newResult]);

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

              {settings.sacrifice.car.enabled && settings.sacrifice.car.value > 0 && (() => {
                const carSacrificeAnnual = sacrificeAnnual(settings.sacrifice.car.mode, settings.sacrifice.car.value);
                const carSacrificePerPeriod = scaleByPeriod(carSacrificeAnnual, resultPeriod, settings.hoursPerWeek, settings.daysPerWeek);
                const carBiKPerPeriod = scaleByPeriod(current.carBiKTaxableValue, resultPeriod, settings.hoursPerWeek, settings.daysPerWeek);
                // Net = BiK increase minus salary reduction (net income adjustment)
                const carNetPerPeriod = carBiKPerPeriod - carSacrificePerPeriod;
                return (
                  <>
                    <ResultRow label="Salary Sacrifice – Car" value={carNetPerPeriod} />
                    <View style={styles.pensionBox}>
                      <View style={styles.pensionRow}>
                        <Text style={styles.pensionLabel}>Salary reduction</Text>
                        <Text style={styles.pensionValue}>{formatCurrency(-carSacrificePerPeriod)}</Text>
                      </View>
                      <View style={styles.pensionRow}>
                        <Text style={styles.pensionLabel}>BiK taxable increase</Text>
                        <Text style={styles.pensionValue}>+{formatCurrency(carBiKPerPeriod)}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
              {settings.sacrifice.bike.enabled && settings.sacrifice.bike.value > 0 && (
                <ResultRow
                  label="Salary Sacrifice – Bike"
                  value={-scaleByPeriod(sacrificeAnnual(settings.sacrifice.bike.mode, settings.sacrifice.bike.value), resultPeriod, settings.hoursPerWeek, settings.daysPerWeek)}
                />
              )}

              {current.pension.employeeContrib > 0 && (
                <>
                  <ResultRow label="Workplace Pension" value={-current.pension.employeeContrib} />
                  <View style={styles.pensionBox}>
                    <View style={styles.pensionRow}>
                      <Text style={styles.pensionLabel}>Auto tax saving</Text>
                      <Text style={styles.pensionValue}>{formatCurrency(current.pension.autoTaxSaving)}</Text>
                    </View>
                    <View style={styles.pensionRow}>
                      <Text style={[styles.pensionLabel, styles.pensionLabelBold]}>Net pension cost</Text>
                      <Text style={[styles.pensionValue, styles.pensionValueBold]}>{formatCurrency(current.pension.effectiveCost)}</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Private pension — moved here, under workplace pension */}
              {privatePensionBreakdown && (
                <>
                  <TouchableOpacity
                    style={styles.pensionToggleRow}
                    onPress={() => setShowPrivatePensionDetail(v => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pensionToggleInner}>
                      <Text style={styles.pensionToggleLabel}>Private Pension</Text>
                      <View style={styles.pensionToggleRight}>
                        <Text style={styles.pensionToggleValue}>{formatCurrency(-privatePensionBreakdown.netYouPay)}</Text>
                        <Text style={styles.chevron}>{showPrivatePensionDetail ? '▲' : '▼'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {showPrivatePensionDetail && (
                    <View style={styles.pensionBox}>
                      <View style={styles.pensionRow}>
                        <Text style={styles.pensionLabel}>You pay (net)</Text>
                        <Text style={styles.pensionValue}>{formatCurrency(-privatePensionBreakdown.netYouPay)}</Text>
                      </View>
                      <View style={styles.pensionRow}>
                        <Text style={styles.pensionLabel}>Basic rate relief (auto)</Text>
                        <Text style={styles.pensionValue}>+{formatCurrency(privatePensionBreakdown.basicRelief)}</Text>
                      </View>
                      <View style={[styles.pensionRow, styles.pensionDividerRow]}>
                        <Text style={[styles.pensionLabel, styles.pensionLabelBold]}>Total into pension</Text>
                        <Text style={[styles.pensionValue, styles.pensionValueBold]}>{formatCurrency(privatePensionBreakdown.grossContrib)}</Text>
                      </View>
                      {privatePensionBreakdown.saClaim > 0 && (
                        <View style={styles.pensionRow}>
                          <Text style={[styles.pensionLabel, styles.saClaimLabel]}>SA claimable</Text>
                          <Text style={[styles.pensionValue, styles.saClaimValue]}>+{formatCurrency(privatePensionBreakdown.saClaim)}</Text>
                        </View>
                      )}
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

              {current.adjustedNetIncome !== current.grossSalary && (
                <ResultRow label="Adjusted Net Income" value={current.adjustedNetIncome} accent />
              )}

              {/* SA note — shown if private pension + higher/additional rate taxpayer */}
              {privatePensionBreakdown && privatePensionBreakdown.annualSaClaim > 0 && (
                <View style={styles.saNoteBox}>
                  <Text style={styles.saNoteText}>
                    💡 You can claim an extra{' '}
                    <Text style={styles.saNoteAmount}>{formatCurrency(privatePensionBreakdown.annualSaClaim)}</Text>
                    {' '}tax relief on your private pension contributions for this year via{' '}
                    <Text style={styles.saNoteLink}>Self Assessment</Text>.
                  </Text>
                </View>
              )}
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
  pensionBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  pensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  pensionDividerRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 6,
  },
  pensionLabel: {
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  pensionLabelBold: {
    color: colors.text,
    fontWeight: '600',
  },
  pensionValue: {
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pensionValueBold: {
    color: colors.text,
    fontWeight: '700',
  },
  pensionToggleRow: {
    paddingVertical: 2,
  },
  pensionToggleInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pensionToggleLabel: {
    fontSize: font.sizes.md,
    color: colors.textSecondary,
    flex: 1,
  },
  pensionToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pensionToggleValue: {
    fontSize: font.sizes.md,
    fontWeight: '600',
    color: colors.text,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
  },
  saClaimLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  saClaimValue: {
    color: colors.primary,
    fontWeight: '700',
  },
  saNoteBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  saNoteText: {
    fontSize: font.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  saNoteAmount: {
    color: colors.primary,
    fontWeight: '700',
  },
  saNoteLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
