import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {resolveInviteCode} from '../constants/mockData';
import {useAppData} from '../context/AppContext';
import {FormInput, PrimaryButton, Screen, ScreenHeader, Section} from '../components/UI';
import {toast} from '../utils/toast';

export const OnboardingScreen = () => {
  const {completeOnboarding} = useAppData();
  const [inviteCode, setInviteCode] = useState('');
  const [otp, setOtp] = useState('');
  const [verified, setVerified] = useState(false);
  const profile = useMemo(() => resolveInviteCode(inviteCode), [inviteCode]);

  const verifyOtp = () => {
    if (otp.length !== 6) {
      toast.error('OTP required', 'Enter a valid 6 digit OTP.');
      return;
    }
    if (!verified) {
      toast.success('OTP verified', 'You can continue to complete setup.');
    }
    setVerified(true);
  };

  const complete = async () => {
    if (!profile) {
      toast.error('Invalid invite', 'Use a valid company invite code (try ALLPAY123).');
      return;
    }
    if (!verified) {
      toast.info('Verify OTP first', 'Enter the 6 digit code and tap Verify OTP.');
      return;
    }
    await completeOnboarding(profile);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Welcome to Allpay"
          subtitle="Securely connect your company account in under 3 minutes."
        />

        <Section title="Step 1: Company invite">
          <FormInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Enter invite code or QR decoded code"
            autoCapitalize="characters"
          />
          <Text style={styles.helpText}>Demo invite code: ALLPAY123</Text>
        </Section>

        <Section title="Step 2: Verify profile">
          <View style={styles.infoGrid}>
            <Text style={styles.infoLabel}>Company</Text>
            <Text style={styles.infoValue}>{profile?.companyName ?? '--'}</Text>
            <Text style={styles.infoLabel}>Employee</Text>
            <Text style={styles.infoValue}>{profile?.employeeName ?? '--'}</Text>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{profile?.department ?? '--'}</Text>
          </View>
        </Section>

        <Section title="Step 3: OTP verification">
          <FormInput
            value={otp}
            onChangeText={setOtp}
            placeholder="Enter 6 digit OTP"
            keyboardType="number-pad"
            maxLength={6}
          />
          <PrimaryButton label="Verify OTP" onPress={verifyOtp} />
          <Text style={styles.helpText}>For demo, enter any 6-digit OTP.</Text>
        </Section>

        <PrimaryButton label="Complete onboarding" onPress={complete} />
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  infoGrid: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoLabel: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
});
