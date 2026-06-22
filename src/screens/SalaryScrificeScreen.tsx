import React from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { AppSettings, CarSchemeSettings, SacrificeItem, SacrificeMode, SalaryScrificeSettings } from '../types';
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

function NumInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [text, setText] = React.useState(value > 0 ? String(value) : '');
  return (
    <TextInput
      style={styles.valInput}
      keyboardType="decimal-pad"
      value={text}
      placeholder={placeholder ?? '0'}
      placeholderTextColor={colors.textMuted}
      onChangeText={(t) => { setText(t); const n = parseFloat(t); if (!isNaN(n) && n >= 0) onChange(n); }}
      onBlur={() => setText(value > 0 ? String(value) : '')}
    />
  );
}

// BiK rate lookup for common CO2 bands (2025/26)
function bikRateForCO2(co2: number): number {
  if (co2 === 0) return 3;          // pure electric
  if (co2 <= 50) return 5;          // ULEV / plug-in hybrid
  if (co2 <= 54) return 15;
  if (co2 <= 59) return 16;
  if (co2 <= 64) return 17;
  if (co2 <= 69) return 18;
  if (co2 <= 74) return 19;
  if (co2 <= 79) return 20;
  if (co2 <= 84) return 21;
  if (co2 <= 89) return 22;
  if (co2 <= 94) return 23;
  if (co2 <= 99) return 24;
  if (co2 <= 104) return 25;
  if (co2 <= 109) return 26;
  if (co2 <= 114) return 27;
  if (co2 <= 119) return 28;
  if (co2 <= 124) return 29;
  if (co2 <= 129) return 30;
  if (co2 <= 134) return 31;
  if (co2 <= 139) return 32;
  if (co2 <= 144) return 33;
  if (co2 <= 149) return 34;
  if (co2 <= 154) return 35;
  if (co2 <= 159) return 36;
  if (co2 <= 164) return 37;
  return 37; // cap at 37%
}

interface CarSectionProps {
  car: CarSchemeSettings;
  annualSalary: number;
  onUpdate: (patch: Partial<CarSchemeSettings>) => void;
}

function CarSection({ car, annualSalary, onUpdate }: CarSectionProps) {
  const [co2Text, setCo2Text] = React.useState('');
  const annualSacrifice = car.enabled ? resolveAnnual(car.mode, car.value) : 0;
  const biKValue = car.p11dValue > 0 && car.bikRate > 0 ? car.p11dValue * (car.bikRate / 100) : 0;
  const hasBiK = car.enabled && biKValue > 0;

  function handleCO2Change(t: string) {
    setCo2Text(t);
    const n = parseFloat(t);
    if (!isNaN(n) && n >= 0) {
      onUpdate({ bikRate: bikRateForCO2(n) });
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.sectionTitle}>Company Car Scheme</Text>
        <Switch
          value={car.enabled}
          onValueChange={(v) => onUpdate({ enabled: v })}
          trackColor={{ true: colors.primary }}
          thumbColor={car.enabled ? '#000' : colors.textSecondary}
        />
      </View>

      <Text style={styles.note}>
        Salary sacrifice reduces your gross pay before tax. HMRC also charges income tax on the car's Benefit in Kind (BiK) value based on P11D price × CO2 rate — this is shown separately on your tax code or P11D.
      </Text>

      {car.enabled && (
        <>
          {/* Salary sacrifice amount */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Monthly lease / salary sacrifice</Text>
            <View style={styles.inputRow}>
              <ModeToggle mode={car.mode} onChange={(m) => onUpdate({ mode: m })} />
              <NumInput value={car.value} onChange={(v) => onUpdate({ value: v })} placeholder="0" />
              {annualSacrifice > 0 && (
                <Text style={styles.resolvedAmount}>{formatGBP(annualSacrifice)}/yr</Text>
              )}
            </View>
          </View>

          {/* P11D value */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>P11D value (list price of car)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.prefix}>£</Text>
              <NumInput value={car.p11dValue} onChange={(v) => onUpdate({ p11dValue: v })} placeholder="e.g. 25000" />
            </View>
          </View>

          {/* CO2 + BiK rate */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CO2 emissions (g/km) — auto-sets BiK rate</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.valInput, { flex: 1 }]}
                keyboardType="decimal-pad"
                value={co2Text}
                placeholder="e.g. 120"
                placeholderTextColor={colors.textMuted}
                onChangeText={handleCO2Change}
              />
              <Text style={styles.resolvedAmount}>BiK rate</Text>
              <View style={styles.bikRateBox}>
                <TextInput
                  style={styles.bikRateInput}
                  keyboardType="decimal-pad"
                  value={car.bikRate > 0 ? String(car.bikRate) : ''}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(t) => { const n = parseFloat(t); if (!isNaN(n) && n >= 0 && n <= 37) onUpdate({ bikRate: n }); }}
                />
                <Text style={styles.pct}>%</Text>
              </View>
            </View>
          </View>

          {hasBiK && (
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>P11D value</Text>
                <Text style={styles.infoValue}>{formatGBP(car.p11dValue)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>BiK rate</Text>
                <Text style={styles.infoValue}>{car.bikRate}%</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Annual taxable BiK benefit</Text>
                <Text style={styles.infoValue}>{formatGBP(biKValue)}</Text>
              </View>
              <Text style={styles.hintSmall}>
                This adds to your taxable income. Income tax on the BiK is shown on the Calculator tab.
              </Text>
              {car.bikRate > 5 && (
                <Text style={styles.hintSmall}>
                  CO2 &gt;75g/km: OpRA rules apply — your salary sacrifice doesn't save employee NI for this car type.
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function SalaryScrificeScreen({ annualSalary, settings, onSettingsChange }: Props) {
  const s = settings.sacrifice;

  function updateCar(patch: Partial<CarSchemeSettings>) {
    onSettingsChange({ ...settings, sacrifice: { ...s, car: { ...s.car, ...patch } } });
  }

  function updateBike(patch: Partial<SacrificeItem>) {
    onSettingsChange({ ...settings, sacrifice: { ...s, bike: { ...s.bike, ...patch } } });
  }

  const bikeAnnual = s.bike.enabled ? resolveAnnual(s.bike.mode, s.bike.value) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Salary Sacrifice</Text>

        {!annualSalary && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Enter a salary in the Calculator tab first.</Text>
          </View>
        )}

        <CarSection car={s.car} annualSalary={annualSalary} onUpdate={updateCar} />

        {/* Bike */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Cycle to Work</Text>
            <Switch
              value={s.bike.enabled}
              onValueChange={(v) => updateBike({ enabled: v })}
              trackColor={{ true: colors.primary }}
              thumbColor={s.bike.enabled ? '#000' : colors.textSecondary}
            />
          </View>
          <Text style={styles.note}>Saves income tax AND NI — HMRC exempts bike schemes from OpRA rules.</Text>
          {s.bike.enabled && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount sacrificed</Text>
                <View style={styles.inputRow}>
                  <ModeToggle mode={s.bike.mode} onChange={(m) => updateBike({ mode: m })} />
                  <NumInput value={s.bike.value} onChange={(v) => updateBike({ value: v })} />
                  {bikeAnnual > 0 && (
                    <Text style={styles.resolvedAmount}>{formatGBP(bikeAnnual)}/yr</Text>
                  )}
                </View>
              </View>
              {bikeAnnual > 0 && (
                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{formatGBP(bikeAnnual / 12)}/mo before tax & NI</Text>
                    <Text style={styles.infoValue}>{formatGBP(bikeAnnual)}/yr</Text>
                  </View>
                </View>
              )}
            </>
          )}
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: font.sizes.lg, fontWeight: '700', color: colors.text },
  note: { fontSize: font.sizes.xs, color: colors.textSecondary, lineHeight: 17 },
  inputGroup: { gap: spacing.xs },
  inputLabel: { fontSize: font.sizes.sm, color: colors.textSecondary, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { fontSize: font.sizes.md, color: colors.textSecondary, fontWeight: '600' },
  valInput: {
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 80,
  },
  resolvedAmount: { fontSize: font.sizes.sm, color: colors.textSecondary, minWidth: 60, textAlign: 'right' },
  bikRateBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bikRateInput: {
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontSize: font.sizes.md,
    fontWeight: '600',
    textAlign: 'right',
    width: 52,
  },
  pct: { fontSize: font.sizes.md, color: colors.textSecondary },
  infoBox: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { fontSize: font.sizes.sm, color: colors.textSecondary, flex: 1 },
  infoValue: { fontSize: font.sizes.sm, color: colors.text, fontWeight: '600' },
  hintSmall: { fontSize: font.sizes.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
});
