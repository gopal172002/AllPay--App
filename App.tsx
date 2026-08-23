import {DefaultTheme, NavigationContainer} from '@react-navigation/native';
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
import {PaymentQrPayScreen} from './src/screens/PaymentQrPayScreen';
import {PaymentResultScreen} from './src/screens/PaymentResultScreen';
import {ScannerScreen} from './src/screens/ScannerScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {TransactionDetailScreen} from './src/screens/TransactionDetailScreen';
import {TransactionHistoryScreen} from './src/screens/TransactionHistoryScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f4f7fb',
    card: '#ffffff',
    primary: '#1557d5',
    text: '#0f172a',
    border: '#dbe3ee',
  },
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1557d5',
        tabBarInactiveTintColor: '#64748b',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {fontWeight: '800', fontSize: 12, marginTop: 2},
        tabBarItemStyle: {paddingTop: 4},
        headerTitleStyle: {fontWeight: '800', color: '#0f172a'},
        headerShadowVisible: false,
        headerStyle: {backgroundColor: '#ffffff'},
        tabBarStyle: {
          minHeight: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: '#dbe3ee',
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
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerBackTitle: '',
          headerShadowVisible: false,
          headerTintColor: '#1557d5',
          headerTitleStyle: {color: '#0f172a', fontWeight: '800'},
          headerStyle: {backgroundColor: '#ffffff'},
          contentStyle: {backgroundColor: '#f4f7fb'},
        }}>
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
          name="PaymentQrPay"
          component={PaymentQrPayScreen}
          options={{title: 'Scan to pay'}}
        />
        <Stack.Screen
          name="PaymentResult"
          component={PaymentResultScreen}
          options={{title: 'Payment result'}}
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
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb" />
      <AppProvider>
        <Navigator />
      </AppProvider>
      <Toast config={toastConfig} />
    </SafeAreaProvider>
  );
}

export default App;
