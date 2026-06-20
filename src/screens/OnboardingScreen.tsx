import React, {useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useAppData} from '../context/AppContext';
import {FormInput, PrimaryButton, Screen, ScreenHeader, Section, SecondaryButton} from '../components/UI';
import {
  completeOnboardingApi,
  confirmProfile,
  mapBackendProfile,
  sendOtp,
  verifyInviteCode,
  verifyOtp,
  type BackendEmployeeProfile,
} from '../services/onboarding';
import {toast} from '../utils/toast';

type Step = 'invite' | 'profile' | 'otp' | 'loading';
const visibleSteps: Array<{key: Exclude<Step, 'loading'>; label: string}> = [
  {key: 'invite', label: 'Invite'},
  {key: 'profile', label: 'Profile'},
  {key: 'otp', label: 'OTP'},
];

export const OnboardingScreen = () => {
  const {finishEmployeeLogin} = useAppData();
  const [step, setStep] = useState<Step>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [onboardingToken, setOnboardingToken] = useState('');
  const [backendProfile, setBackendProfile] = useState<BackendEmployeeProfile | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [busy, setBusy] = useState(false);
  const activeStepIndex = Math.max(
    0,
    visibleSteps.findIndex(item => item.key === step),
  );

  const resetToInvite = () => {
    setStep('invite');
    setOnboardingToken('');
    setBackendProfile(null);
    setIsReturningUser(false);
    setOtp('');
  };

  const handleInviteContinue = async () => {
    const code = inviteCode.trim();
    if (!code) {
      toast.error('Invite required', 'Enter the mobile invite code from your admin (e.g. All123ID).');
      return;
    }
    setBusy(true);
    try {
      const verified = await verifyInviteCode(code);
      if (!verified.ok) {
        toast.error('Invalid invite', verified.message);
        return;
      }

      setBackendProfile(verified.profile);
      setOnboardingToken(verified.onboardingToken);
      setIsReturningUser(verified.alreadyOnboarded);
      setPhone(verified.profile.phone || '');
      setStep('profile');
      toast.success(
        verified.alreadyOnboarded ? 'Invite verified' : 'Invite accepted',
        verified.alreadyOnboarded
          ? `Welcome back, ${verified.profile.name}! Confirm your details to continue.`
          : `Hello ${verified.profile.name}! Confirm your details.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmProfile = async () => {
    if (!onboardingToken || !backendProfile) {
      return;
    }
    const mobile = phone.trim();
    if (mobile.length < 10) {
      toast.error('Phone required', 'Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      const result = await confirmProfile(onboardingToken, mobile, backendProfile.name);
      if (!result.ok) {
        toast.error('Profile error', result.message);
        return;
      }
      setBackendProfile(result.profile);
      const otpResult = await sendOtp(onboardingToken);
      if (!otpResult.ok) {
        toast.error('OTP error', otpResult.message);
        return;
      }
      setStep('otp');
      toast.info('OTP sent', `${otpResult.message} Dev OTP: 123456`);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyAndComplete = async () => {
    if (!onboardingToken) {
      return;
    }
    if (otp.trim().length !== 6) {
      toast.error('OTP required', 'Enter the 6-digit verification code.');
      return;
    }
    setBusy(true);
    try {
      const verified = await verifyOtp(onboardingToken, otp);
      if (!verified.ok) {
        toast.error('OTP failed', verified.message);
        return;
      }
      const done = await completeOnboardingApi(onboardingToken);
      if (!done.ok) {
        toast.error('Setup failed', done.message);
        return;
      }
      await finishEmployeeLogin(mapBackendProfile(done.profile), done.token);
      toast.success(
        isReturningUser ? 'Signed in' : 'Onboarding complete',
        isReturningUser ? `Welcome back, ${done.profile.name}!` : `Welcome, ${done.profile.name}!`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!onboardingToken) {
      return;
    }
    setBusy(true);
    try {
      const result = await sendOtp(onboardingToken);
      if (result.ok) {
        toast.info('OTP resent', `${result.message} Dev OTP: 123456`);
      } else {
        toast.error('OTP error', result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Welcome to Allpay"
          subtitle="Sign in with the mobile invite code from your admin dashboard."
        />

        <View style={styles.stepper}>
          {visibleSteps.map((item, index) => (
            <View style={styles.stepItem} key={item.key}>
              <View
                style={[
                  styles.stepDot,
                  index <= activeStepIndex ? styles.stepDotActive : null,
                ]}>
                <Text
                  style={[
                    styles.stepNumber,
                    index <= activeStepIndex ? styles.stepNumberActive : null,
                  ]}>
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  index <= activeStepIndex ? styles.stepLabelActive : null,
                ]}
                numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {step === 'invite' && (
          <Section title="Step 1: Mobile invite code">
            <FormInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="e.g.  All123ID"
              autoCapitalize="characters"
            />
            <Text style={styles.helpText}>
              Find your code in Admin / Employee Management / Mobile invite column.
            </Text>
            <PrimaryButton
              label={busy ? 'Checking...' : 'Continue'}
              onPress={handleInviteContinue}
              disabled={busy}
            />
          </Section>
        )}

        {step === 'profile' && backendProfile && (
          <Section title={isReturningUser ? 'Step 2: Verify your profile' : 'Step 2: Confirm profile'}>
            <View style={styles.infoGrid}>
              <Text style={styles.infoLabel}>Company</Text>
              <Text style={styles.infoValue}>{backendProfile.companyName}</Text>
              <Text style={styles.infoLabel}>Employee</Text>
              <Text style={styles.infoValue}>{backendProfile.name}</Text>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{backendProfile.email}</Text>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue}>{backendProfile.department}</Text>
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>{backendProfile.employeeId || 'Pending assignment'}</Text>
            </View>
            <FormInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Mobile number (required)"
              keyboardType="phone-pad"
            />
            <PrimaryButton
              label={busy ? 'Saving...' : isReturningUser ? 'Send OTP & continue' : 'Confirm & send OTP'}
              onPress={handleConfirmProfile}
              disabled={busy}
            />
            <SecondaryButton label="Use different invite code" onPress={resetToInvite} />
          </Section>
        )}

        {step === 'otp' && backendProfile && (
          <Section title="Step 3: Verify OTP">
            <Text style={styles.helpText}>
              Enter the 6-digit code sent to {backendProfile.email}. In development, use 123456.
            </Text>
            <FormInput
              value={otp}
              onChangeText={setOtp}
              placeholder="6 digit OTP"
              keyboardType="number-pad"
              maxLength={6}
            />
            <PrimaryButton
              label={busy ? 'Verifying...' : isReturningUser ? 'Verify OTP & sign in' : 'Verify & complete setup'}
              onPress={handleVerifyAndComplete}
              disabled={busy}
            />
            <SecondaryButton label="Resend OTP" onPress={handleResendOtp} />
            <SecondaryButton label="Back" onPress={() => setStep('profile')} />
          </Section>
        )}

        {busy && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1557d5" />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 24,
    flexGrow: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbe3ee',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7d2e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: '#1557d5',
    backgroundColor: '#1557d5',
  },
  stepNumber: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabelActive: {
    color: '#0f172a',
    fontWeight: '800',
  },
  infoGrid: {
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
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
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingBottom: 10,
    lineHeight: 21,
  },
  helpText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 18,
  },
  loadingRow: {
    alignItems: 'center',
    marginTop: 12,
  },
});
