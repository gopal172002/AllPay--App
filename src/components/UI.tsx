import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {Edge} from 'react-native-safe-area-context';

const statusTone = (status: string): {bg: string; fg: string} => {
  if (status === 'Approved') {
    return {bg: '#dcfce7', fg: '#166534'};
  }
  if (status === 'Rejected' || status === 'Abandoned') {
    return {bg: '#fee2e2', fg: '#991b1b'};
  }
  if (status === 'Pending Approval' || status === 'Flagged') {
    return {bg: '#fef3c7', fg: '#92400e'};
  }
  return {bg: '#dbeafe', fg: '#1d4ed8'};
};

type ScreenProps = {
  children: React.ReactNode;
  /** Set false for tab root screens so bottom inset is not doubled with the tab bar. */
  safeBottom?: boolean;
  /**
   * Set false when a parent (stack/tab) already shows a header — the navigator lays out
   * below the status bar; applying the top safe-area edge again leaves a large empty band.
   */
  safeTop?: boolean;
};

export const Screen = ({
  children,
  safeBottom = true,
  safeTop = true,
}: ScreenProps) => {
  const edges: ReadonlyArray<Edge> = [
    ...(safeTop ? (['top'] as const) : []),
    'right',
    'left',
    ...(safeBottom ? (['bottom'] as const) : []),
  ];
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {children}
    </SafeAreaView>
  );
};

export const ScreenHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) => (
  <View style={styles.headerWrap}>
    <Text style={styles.headerTitle}>{title}</Text>
    {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
  </View>
);

export const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export const PrimaryButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    style={({pressed}) => [
      styles.button,
      pressed ? styles.buttonPressed : null,
      disabled ? styles.buttonDisabled : null,
    ]}
    onPress={onPress}
    disabled={disabled}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

export const SecondaryButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    style={({pressed}) => [
      styles.secondaryButton,
      pressed ? styles.secondaryButtonPressed : null,
    ]}
    onPress={onPress}>
    <Text style={styles.secondaryButtonText}>{label}</Text>
  </Pressable>
);

export const FormInput = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor="#9ca3af"
    style={[styles.input, props.editable === false ? styles.inputReadonly : null]}
    {...props}
  />
);

export const StatusPill = ({status}: {status: string}) => (
  <View style={[styles.pill, {backgroundColor: statusTone(status).bg}]}>
    <Text style={[styles.pillText, {color: statusTone(status).fg}]}>{status}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerWrap: {
    marginBottom: 10,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 14,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: '#1d4ed8',
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#f8fafc',
  },
  secondaryButtonPressed: {
    backgroundColor: '#eff6ff',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#0f172a',
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  inputReadonly: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
