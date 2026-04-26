import React from 'react';
import {Alert, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {Screen, ScreenHeader, SecondaryButton, Section} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {toast} from '../utils/toast';

export const SettingsScreen = () => {
  const {
    locationEnabled,
    setLocationCaptureEnabled,
    installedUpiApps,
    refreshInstalledUpiApps,
    logout,
  } = useAppData();

  const toggleLocation = (next: boolean) => {
    if (next) {
      Alert.alert(
        'Consent required',
        'By enabling GPS capture, you consent to one-time location capture during payment confirmation. No background tracking is performed.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'I consent',
            onPress: () => {
              setLocationCaptureEnabled(true).catch(() => null);
            },
          },
        ],
      );
      return;
    }
    setLocationCaptureEnabled(false).catch(() => null);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'This will clear your account data and return to onboarding.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            logout().catch(() => toast.error('Logout failed', 'Please try again.'));
          },
        },
      ],
    );
  };

  return (
    <Screen safeBottom={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Settings"
          subtitle="Control privacy and device integration options."
        />
        <Section title="Location capture (opt-in)">
          <View style={styles.row}>
            <Text style={styles.label}>Capture GPS at payment confirmation</Text>
            <Switch value={locationEnabled} onValueChange={toggleLocation} />
          </View>
          <Text style={styles.helpText}>
            If permission is denied, GPS stays null and payment flow is unaffected.
          </Text>
        </Section>

        <Section title="Detected UPI apps">
          {installedUpiApps.length === 0 ? (
            <Text style={styles.helpText}>No installed UPI app detected.</Text>
          ) : (
            installedUpiApps.map(item => (
              <View key={item.id} style={styles.appRow}>
                <Text style={styles.appLogo}>{item.logo}</Text>
                <Text style={styles.item}>{item.name}</Text>
              </View>
            ))
          )}
          <SecondaryButton label="Refresh installed UPI apps" onPress={refreshInstalledUpiApps} />
        </Section>

        <Section title="Account">
          <Text style={styles.helpText}>
            Logout will clear saved tokens, profile, and local transaction data.
          </Text>
          <SecondaryButton label="Logout" onPress={handleLogout} />
        </Section>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    color: '#1e293b',
    fontWeight: '600',
  },
  helpText: {
    color: '#64748b',
    marginTop: 8,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  appLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    color: '#1e3a8a',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 10,
    overflow: 'hidden',
    paddingTop: 6,
  },
  item: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
