import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { RATES, TaxYear } from '../engine/taxRates';
import { colors, spacing, radius, font } from '../theme';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`;

export function HelpScreen({ taxYear }: { taxYear: TaxYear }) {
  const sl = RATES[taxYear].studentLoan;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Help</Text>

        <View style={styles.card}>
          <Section title="Tax year">
            {`This calculator uses ${taxYear} UK tax rates for England, Wales, Northern Ireland, and Scotland. You can switch tax year in Settings. It is for indicative purposes only — for completing tax returns please consult a tax professional.`}
          </Section>

          <View style={styles.divider} />

          <Section title="Income Tax">
            {`England, Wales & NI:\n• Personal allowance: £12,570\n• Basic rate (20%): up to £50,270\n• Higher rate (40%): £50,271–£125,140\n• Additional rate (45%): above £125,140\n• Personal allowance tapers by £1 per £2 earned above £100,000\n\nScotland has separate rates and bands.`}
          </Section>

          <View style={styles.divider} />

          <Section title="National Insurance">
            {`Class 1 employee contributions:\n• 8% on earnings £12,570–£50,270\n• 2% above £50,270\n• No NI from State Pension Age (currently 66)`}
          </Section>

          <View style={styles.divider} />

          <Section title="Pension">
            {`Pension contributions are deducted from gross salary before tax (net pay arrangement).\n\n• Auto tax relief: 20% basic rate saving you get automatically\n• Self-assessment claim: additional relief for higher rate (40%) or additional rate (45%) taxpayers — reclaim the difference via your self-assessment tax return`}
          </Section>

          <View style={styles.divider} />

          <Section title="Student Loans">
            {`Repayments are 9% of income above the threshold (${taxYear}):\n• Plan 1: ${gbp(sl.plan1.threshold)}\n• Plan 2: ${gbp(sl.plan2.threshold)}\n• Plan 4 (Scotland): ${gbp(sl.plan4.threshold)}\n• Plan 5: ${gbp(sl.plan5.threshold)}\n• Postgraduate: 6% above ${gbp(sl.postgrad.threshold)}`}
          </Section>
        </View>
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
  section: { gap: spacing.xs },
  heading: { fontSize: font.sizes.md, fontWeight: '700', color: colors.text },
  body: { fontSize: font.sizes.sm, color: colors.textSecondary, lineHeight: 20 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
