import React, { useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { calculate, toPeriodResult, calculateFullPension, TaxResult, Period } from '../engine/taxEngine';
import { PeriodSelector } from '../components/PeriodSelector';
import { ResultRow, formatCurrency } from '../components/ResultRow';
import { AppSettings, PensionMode } from '../types';
import { colors, spacing, radius, font } from '../theme';

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-9879821077971587/1830555599';

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

  function getPrivateContrib(annualGross: number): number {
    const p = settings.pension;
    if (!p.privateEnabled || p.privateValue === 0) return 0;
    return p.privateMode === 'percent' ? annualGross * (p.privateValue / 100) : p.privateValue;
  }

  function getEmployerPension(annualGross: number): number {
    const p = settings.pension;
    if (!p.payeEnabled) return 0;
    return pensionAnnual(annualGross, p.payeEmployerMode, p.payeEmployerValue);
  }

  const totalSacrifice = useMemo(() => {
    const s = settings.sacrifice;
    const car = s.car.enabled ? (s.car.mode === 'monthly' ? s.car.value * 12 : s.car.value) : 0;
    const bike = s.bike.enabled ? (s.bike.mode === 'monthly' ? s.bike.value * 12 : s.bike.value) : 0;
    return car + bike;
  }, [settings.sacrifice]);

  const carBiKValue = useMemo(() => {
    const car = settings.sacrifice.car;
    if (!car.enabled || car.p11dValue <= 0 || car.bikRate <= 0) return 0;
    return car.p11dValue * (car.bikRate / 100);
  }, [settings.sacrifice.car]);

  const newResult = useMemo(() => {
    if (newAnnual === null) return null;
    const annual = calculate({
      grossSalary: newAnnual,
      payeContrib: getPayeContrib(newAnnual),
      privateContrib: getPrivateContrib(newAnnual),
      totalSalaryScrifice: totalSacrifice,
      carBiKValue,
      employerPensionContrib: getEmployerPension(newAnnual),
      taxYear: settings.taxYear,
      scottishRates: settings.scottishRates,
      studentLoan: settings.studentLoan,
      payNI: settings.payNI,
      ageGroup: settings.ageGroup,
      hoursPerWeek: settings.hoursPerWeek,
      daysPerWeek: settings.daysPerWeek,
    });
    return toPeriodResult(annual, settings.hoursPerWeek, settings.daysPerWeek);
  }, [newAnnual, settings, totalSacrifice, carBiKValue]);

  const oldResult = useMemo(() => {
    if (oldAnnual === null) return null;
    const annual = calculate({
      grossSalary: oldAnnual,
      payeContrib: getPayeContrib(oldAnnual),
      privateContrib: getPrivateContrib(oldAnnual),
      totalSalaryScrifice: totalSacrifice,
      carBiKValue,
      employerPensionContrib: getEmployerPension(oldAnnual),
      taxYear: settings.taxYear,
      scottishRates: settings.scottishRates,
      studentLoan: settings.studentLoan,
      payNI: settings.payNI,
      ageGroup: settings.ageGroup,
      hoursPerWeek: settings.hoursPerWeek,
      daysPerWeek: settings.daysPerWeek,
    });
    return toPeriodResult(annual, settings.hoursPerWeek, settings.daysPerWeek);
  }, [oldAnnual, settings, totalSacrifice, carBiKValue]);

  const privateSaClaim = useMemo(() => {
    if (newAnnual === null) return 0;
    const p = settings.pension;
    if (!p.privateEnabled || p.privateValue === 0) return 0;
    const privateGross = p.privateMode === 'percent' ? newAnnual * (p.privateValue / 100) : p.privateValue;
    const payeEmp = getPayeContrib(newAnnual);
    const payeEmpR = p.payeEnabled ? (p.payeEmployerMode === 'percent' ? newAnnual * (p.payeEmployerValue / 100) : p.payeEmployerValue) : 0;
    const full = calculateFullPension(newAnnual, payeEmp, payeEmpR, privateGross, settings.scottishRates, settings.taxYear);
    return full.privateSaClaim;
  }, [newAnnual, settings]);

  // PA-restore optimiser (ST-7): adjusted net income between £100k and
  // £125,140 sits in the 60% taper zone — an extra contribution of
  // (adjusted − 100,000) restores the full Personal Allowance.
  const paRestoreHint = useMemo(() => {
    if (newAnnual === null) return null;
    const payeContrib = getPayeContrib(newAnnual);
    const adjusted = newAnnual - payeContrib - totalSacrifice + carBiKValue;
    if (adjusted <= 100000 || adjusted > 125140) return null;
    const topUp = adjusted - 100000;
    const base = {
      grossSalary: newAnnual,
      payeContrib,
      totalSalaryScrifice: totalSacrifice,
      carBiKValue,
      taxYear: settings.taxYear,
      scottishRates: settings.scottishRates,
      studentLoan: settings.studentLoan,
      payNI: settings.payNI,
      ageGroup: settings.ageGroup,
      hoursPerWeek: settings.hoursPerWeek,
      daysPerWeek: settings.daysPerWeek,
    } as const;
    const now = calculate(base);
    const restored = calculate({ ...base, payeContrib: payeContrib + topUp });
    const saving = now.incomeTax - restored.incomeTax;
    return { topUp, pct: Math.round((saving / topUp) * 100) };
  }, [newAnnual, settings, totalSacrifice, carBiKValue]);

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
          <Text style={styles.title}>{`UK Salary & Tax Calculator ${settings.taxYear}`}</Text>

          {/* Salary inputs */}
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel} numberOfLines={1}>New</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>£</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={newSalary}
                  onChangeText={(t) => {
                    const raw = t.replace(/[^0-9.]/g, '');
                    const [int, dec] = raw.split('.');
                    const formatted = int === '' ? '' : int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec !== undefined ? '.' + dec : '');
                    setNewSalary(formatted);
                  }}
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel} numberOfLines={1}>Old</Text>
              <View style={[styles.inputWrapper, styles.inputWrapperAlt]}>
                <Text style={styles.currencyPrefix}>£</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  value={oldSalary}
                  onChangeText={(t) => {
                    const raw = t.replace(/[^0-9.]/g, '');
                    const [int, dec] = raw.split('.');
                    const formatted = int === '' ? '' : int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec !== undefined ? '.' + dec : '');
                    setOldSalary(formatted);
                  }}
                />
              </View>
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
                      <ResultRow
                        label={`Auto tax saving (${Math.round((current.pension.autoTaxSaving / current.pension.employeeContrib) * 100)}%)`}
                        value={current.pension.autoTaxSaving}
                        indent
                        dimmed
                      />
                      {current.pension.selfAssessmentClaim > 0 && (
                        <ResultRow label="Claim via self-assessment" value={current.pension.selfAssessmentClaim} indent dimmed />
                      )}
                      <ResultRow label="Net pension cost" value={current.pension.effectiveCost} indent />
                    </View>
                  )}
                </>
              )}

              {current.salarySacrifice > 0 && (
                <ResultRow label="Salary Sacrifice" value={current.salarySacrifice} />
              )}
              <ResultRow label="Taxable Income" value={current.taxableIncome} />
              <ResultRow label="Income Tax" value={current.incomeTax} />
              {current.carBiKTax > 0 && (
                <ResultRow label="of which car BiK tax" value={current.carBiKTax} indent dimmed />
              )}
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

              {privateSaClaim > 0 && (
                <View style={styles.saNote}>
                  <Text style={styles.saNoteText}>
                    💡 Claim {formatCurrency(privateSaClaim)} back via Self Assessment — higher-rate relief on your private pension. Submit via your annual tax return.
                  </Text>
                </View>
              )}

              {paRestoreHint && (
                <View style={styles.saNote}>
                  <Text style={styles.saNoteText}>
                    💡 Contribute {formatCurrency(paRestoreHint.topUp)} to your pension to restore your Personal Allowance — effective relief {paRestoreHint.pct}%.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Cost to employer */}
          {current && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Cost to Employer</Text>
              <View style={styles.divider} />
              <ResultRow label="Gross Salary" value={current.grossSalary} />
              <ResultRow label="Employer NI (15%)" value={current.employerNI} />
              {current.employerPension > 0 && (
                <ResultRow label="Employer Pension" value={current.employerPension} />
              )}
              <View style={styles.divider} />
              <ResultRow label="Total Cost" value={current.employerCost} bold />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
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
    width: 44,
    flexShrink: 0,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    minWidth: 0,
  },
  inputWrapperAlt: {
    backgroundColor: '#1E1E1E',
  },
  currencyPrefix: {
    color: colors.textSecondary,
    fontSize: font.sizes.md,
    fontWeight: '600',
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: colors.inputText,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 0,
    padding: 0,
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
  saNote: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  saNoteText: {
    color: colors.primary,
    fontSize: font.sizes.sm,
    fontWeight: '500',
    lineHeight: 18,
  },
});
