import Toast from 'react-native-toast-message';

type ToastParams = {title: string; message?: string};

const show = (type: 'success' | 'error' | 'info', {title, message}: ToastParams) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 2800,
    topOffset: 44,
  });
};

export const toast = {
  success: (title: string, message?: string) => show('success', {title, message}),
  error: (title: string, message?: string) => show('error', {title, message}),
  info: (title: string, message?: string) => show('info', {title, message}),
};
