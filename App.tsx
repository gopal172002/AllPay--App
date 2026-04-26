import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {toastConfig} from './src/config/toastConfig';
import {AppProvider, useAppData} from './src/context/AppContext';
import {RootStackParamList} from './src/navigation';
import {HomeScreen} from './src/screens/HomeScreen';
import {OnboardingScreen} from './src/screens/OnboardingScreen';
import {PaymentScreen} from './src/screens/PaymentScreen';
import {ScannerScreen} from './src/screens/ScannerScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {TransactionDetailScreen} from './src/screens/TransactionDetailScreen';
import {TransactionHistoryScreen} from './src/screens/TransactionHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: {fontWeight: '700', fontSize: 12},
        headerTitleStyle: {fontWeight: '800', color: '#0f172a'},
        headerShadowVisible: false,
        headerStyle: {backgroundColor: '#f8fafc'},
        tabBarStyle: {
          minHeight: 52 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          backgroundColor: '#ffffff',
        },
      }}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="History" component={TransactionHistoryScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
};

const Navigator = () => {
  const {profile} = useAppData();
  if (!profile) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Scan"
          component={ScannerScreen}
          options={{title: 'Scan QR'}}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{title: 'Payment'}}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{title: 'Transaction Detail'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppProvider>
        <Navigator />
      </AppProvider>
      <Toast config={toastConfig} />
    </SafeAreaProvider>
  );
}

export default App;
