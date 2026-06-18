import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainScreen } from './src/screens/MainScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import { AppSettings, DEFAULT_SETTINGS } from './src/types';
import { colors } from './src/theme';

// Simple icon text until vector icons are wired up
function TabIcon({ icon }: { icon: string }) {
  return null; // replaced by label only until icons added
}

const Tab = createBottomTabNavigator();

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.tabBarActive,
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Main"
          options={{ tabBarLabel: 'Calculator' }}
        >
          {() => <MainScreen settings={settings} />}
        </Tab.Screen>

        <Tab.Screen
          name="Settings"
          options={{ tabBarLabel: 'Settings' }}
        >
          {() => <SettingsScreen settings={settings} onChange={setSettings} />}
        </Tab.Screen>

        <Tab.Screen
          name="Help"
          component={HelpScreen}
          options={{ tabBarLabel: 'Help' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
