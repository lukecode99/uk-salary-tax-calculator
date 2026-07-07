import React, { useState, useMemo, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import mobileAds from 'react-native-google-mobile-ads';
import { MainScreen } from './src/screens/MainScreen';
import { PensionScreen } from './src/screens/PensionScreen';
import { SalaryScrificeScreen } from './src/screens/SalaryScrificeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import { AppSettings, DEFAULT_SETTINGS, PensionMode } from './src/types';
import { Period } from './src/engine/taxEngine';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

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

function pensionAnnual(gross: number, mode: PensionMode, value: number): number {
  return mode === 'percent' ? gross * (value / 100) : value;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [newSalary, setNewSalary] = useState('');
  const [oldSalary, setOldSalary] = useState('');
  const [inputPeriod, setInputPeriod] = useState<Period>('annual');

  useEffect(() => {
    mobileAds().initialize();
  }, []);

  const annualSalary = useMemo(() => {
    const v = parseFloat(newSalary.replace(/,/g, ''));
    if (isNaN(v) || v < 0) return 0;
    return toAnnual(v, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek);
  }, [newSalary, inputPeriod, settings.hoursPerWeek, settings.daysPerWeek]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          headerShown: false,
        }}
      >
        <Tab.Screen name="Calculator" options={{ tabBarLabel: 'Calculator' }}>
          {() => (
            <MainScreen
              newSalary={newSalary}
              setNewSalary={setNewSalary}
              oldSalary={oldSalary}
              setOldSalary={setOldSalary}
              inputPeriod={inputPeriod}
              setInputPeriod={setInputPeriod}
              settings={settings}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Pension" options={{ tabBarLabel: 'Pension' }}>
          {() => (
            <PensionScreen
              annualSalary={annualSalary}
              settings={settings}
              onSettingsChange={setSettings}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Sacrifice" options={{ tabBarLabel: 'Sacrifice' }}>
          {() => (
            <SalaryScrificeScreen
              annualSalary={annualSalary}
              settings={settings}
              onSettingsChange={setSettings}
            />
          )}
        </Tab.Screen>

        <Tab.Screen name="Settings" options={{ tabBarLabel: 'Settings' }}>
          {() => <SettingsScreen settings={settings} onChange={setSettings} />}
        </Tab.Screen>

        <Tab.Screen name="Help" options={{ tabBarLabel: 'Help' }}>
          {() => <HelpScreen taxYear={settings.taxYear} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
