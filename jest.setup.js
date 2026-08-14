/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(() => Promise.resolve({isConnected: true})),
    addEventListener: jest.fn(() => jest.fn()),
  },
  fetch: jest.fn(() => Promise.resolve({isConnected: true})),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native-camera-kit', () => ({
  Camera: 'Camera',
  CameraType: {Back: 'back'},
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(() => Promise.resolve({assets: []})),
  launchImageLibrary: jest.fn(() => Promise.resolve({assets: []})),
}));

jest.mock('react-native-razorpay', () => ({
  __esModule: true,
  default: {
    open: jest.fn(),
  },
}));

const {NativeModules} = require('react-native');
NativeModules.UpiIntentModule = {
  pay: jest.fn(async () => ({cancelled: true, raw: ''})),
  hasCompatibleApp: jest.fn(async () => true),
};

jest.mock('react-native-toast-message', () => {
  const Toast = () => null;
  Toast.show = jest.fn();
  return {
    __esModule: true,
    default: Toast,
    BaseToast: () => null,
    ErrorToast: () => null,
  };
});
