import React from 'react';
import {Dimensions, StyleSheet} from 'react-native';
import {BaseToast, ErrorToast} from 'react-native-toast-message';
import type {ToastConfigParams} from 'react-native-toast-message';

const screenW = Dimensions.get('window').width;
const maxToastWidth = Math.min(360, screenW * 0.92);

const t1 = {
  fontSize: 13,
  fontWeight: '600' as const,
  lineHeight: 17,
  color: '#0f172a',
};

const t2 = {
  fontSize: 11,
  lineHeight: 15,
  fontWeight: '400' as const,
  color: '#64748b',
  marginTop: 2,
};

const content = {
  paddingVertical: 6,
  paddingHorizontal: 10,
};

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    maxWidth: maxToastWidth,
    width: maxToastWidth,
    borderLeftWidth: 3,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 6,
    elevation: 4,
    marginTop: 4,
    alignSelf: 'center',
  },
  successAccent: {borderLeftColor: '#16a34a'},
  errorAccent: {borderLeftColor: '#dc2626'},
  infoAccent: {borderLeftColor: '#2563eb'},
});

export const toastConfig = {
  success: (props: ToastConfigParams<any>) => (
    <BaseToast
      {...props}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      style={[styles.base, styles.successAccent]}
      contentContainerStyle={content}
      text1Style={t1}
      text2Style={t2}
    />
  ),
  error: (props: ToastConfigParams<any>) => (
    <ErrorToast
      {...props}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      style={[styles.base, styles.errorAccent]}
      contentContainerStyle={content}
      text1Style={t1}
      text2Style={t2}
    />
  ),
  info: (props: ToastConfigParams<any>) => (
    <BaseToast
      {...props}
      text1NumberOfLines={2}
      text2NumberOfLines={3}
      style={[styles.base, styles.infoAccent]}
      contentContainerStyle={content}
      text1Style={t1}
      text2Style={t2}
    />
  ),
};
