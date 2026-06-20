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

const statusTone = (status: string): {bg: string; fg: string; border: string} => {
  if (status === 'Approved') {
    return {bg: '#ecfdf5', fg: '#047857', border: '#bbf7d0'};
  }
  if (status === 'Rejected' || status === 'Abandoned') {
    return {bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca'};
  }
  if (status === 'Pending Approval' || status === 'Flagged') {
    return {bg: '#fffbeb', fg: '#b45309', border: '#fde68a'};
  }
  return {bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe'};
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
    accessibilityRole="button"
    android_ripple={disabled ? undefined : {color: '#1e40af'}}
    style={({pressed}) => [
      styles.button,
      pressed ? styles.buttonPressed : null,
      disabled ? styles.buttonDisabled : null,
    ]}
    onPress={onPress}
    disabled={disabled}>
    <Text style={styles.buttonText} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

export const SecondaryButton = ({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    android_ripple={disabled ? undefined : {color: '#dbeafe'}}
    style={({pressed}) => [
      styles.secondaryButton,
      pressed ? styles.secondaryButtonPressed : null,
      disabled ? styles.secondaryButtonDisabled : null,
    ]}
    onPress={onPress}
    disabled={disabled}>
    <Text style={styles.secondaryButtonText} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

export const FormInput = (props: TextInputProps) => {
  const {style, multiline, ...rest} = props;
  return (
    <TextInput
      placeholderTextColor="#94a3b8"
      multiline={multiline}
      style={[
        styles.input,
        multiline ? styles.inputMultiline : null,
        props.editable === false ? styles.inputReadonly : null,
        style,
      ]}
      {...rest}
    />
  );
};

export const StatusPill = ({status}: {status: string}) => {
  const tone = statusTone(status);
  return (
    <View
      style={[
        styles.pill,
        {backgroundColor: tone.bg, borderColor: tone.border},
      ]}>
      <Text style={[styles.pillText, {color: tone.fg}]} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7fb',
  },
  headerWrap: {
    marginBottom: 14,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 31,
  },
  headerSubtitle: {
    color: '#64748b',
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    elevation: 2,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  button: {
    minHeight: 48,
    backgroundColor: '#1557d5',
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '800',
    fontSize: 15,
    flexShrink: 1,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 8,
    borderColor: '#8fb6ff',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#f8fbff',
  },
  secondaryButtonPressed: {
    backgroundColor: '#eff6ff',
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: '#1557d5',
    fontWeight: '800',
    fontSize: 15,
    flexShrink: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c7d2e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#0f172a',
    fontSize: 15,
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputReadonly: {
    backgroundColor: '#f8fafc',
    color: '#64748b',
  },
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 148,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
