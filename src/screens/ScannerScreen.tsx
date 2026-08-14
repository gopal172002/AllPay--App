import {RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  Linking,
  Platform,
  PermissionsAndroid,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
import {
  FormInput,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Section,
  SecondaryButton,
} from '../components/UI';
import {RootStackParamList} from '../navigation';
import {merchantFromUpiQr} from '../utils/upi';
import {toast} from '../utils/toast';
import {trackUpiEvent} from '../upi/analytics';
import {parseUpiQr as parseValidatedUpiQr} from '../upi/scanner/UpiQrParser';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'Scan'>;

const SCAN_THROTTLE_MS = 2000;

export const ScannerScreen = () => {
  useRoute<R>();
  const navigation = useNavigation<Nav>();
  const [torchOn, setTorchOn] = useState(false);
  const [cameraAuth, setCameraAuth] = useState(Platform.OS !== 'android');
  const [rawManual, setRawManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const lastScanAt = useRef(0);
  const handledValue = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      handledValue.current = null;
      lastScanAt.current = 0;
      trackUpiEvent('upi_scan_started');
    }, []),
  );

  useEffect(() => {
    const requestCamera = async () => {
      if (Platform.OS !== 'android') {
        setCameraAuth(true);
        return;
      }
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera permission',
          message: 'Allpay needs the camera to scan UPI merchant QR codes.',
          buttonPositive: 'Allow',
        },
      );
      if (status === PermissionsAndroid.RESULTS.GRANTED) {
        setCameraAuth(true);
        return;
      }
      if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Camera blocked',
          'Open system settings to enable the camera for Allpay.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open settings', onPress: () => Linking.openSettings()},
          ],
        );
      } else {
        toast.error('Camera required', 'Allow camera access to scan QR codes.');
      }
    };
    requestCamera();
  }, []);

  const onQrValue = useCallback(
    (value: string) => {
      const trimmed = value?.trim() ?? '';
      if (!trimmed) {
        return;
      }
      const now = Date.now();
      if (now - lastScanAt.current < SCAN_THROTTLE_MS) {
        return;
      }
      if (handledValue.current === trimmed) {
        return;
      }
      lastScanAt.current = now;
      const validated = parseValidatedUpiQr(trimmed);
      if (!validated.ok) {
        if (handledValue.current !== trimmed) {
          handledValue.current = trimmed;
          trackUpiEvent('upi_qr_invalid');
          toast.error('Invalid QR', `${validated.message} [${validated.code}]`);
        }
        return;
      }
      trackUpiEvent('upi_qr_scanned');
      handledValue.current = trimmed;
      navigation.navigate('Payment', {merchant: merchantFromUpiQr(validated)});
    },
    [navigation],
  );

  const handleManual = () => {
    onQrValue(rawManual);
  };

  return (
    <Screen safeTop={false}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title="Scan & Pay"
          subtitle="Point the camera at a UPI QR. Payment opens only after you confirm."
        />

        <View style={styles.cameraWrap}>
          {cameraAuth ? (
            <Camera
              style={styles.camera}
              cameraType={CameraType.Back}
              scanBarcode
              showFrame
              laserColor="#3b82f6"
              frameColor="#60a5fa"
              torchMode={torchOn ? 'on' : 'off'}
              onReadCode={e => onQrValue(e.nativeEvent.codeStringValue)}
              onError={e =>
                toast.error('Camera error', e.nativeEvent.errorMessage)
              }
              allowedBarcodeTypes={['qr']}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Text style={styles.placeholderText}>
              {Platform.OS === 'android'
                  ? 'Waiting for camera permission...'
                  : 'Preparing camera...'}
              </Text>
            </View>
          )}
          <SecondaryButton
            label={torchOn ? 'Turn torch off' : 'Turn torch on'}
            onPress={() => setTorchOn(v => !v)}
            disabled={!cameraAuth}
          />
        </View>

        <Section title="Trouble scanning?">
          <Text style={styles.hintText}>
            Ensure the full QR is in the frame. UPI QRs use the
            <Text style={styles.mono}> upi://pay?...</Text> format.
          </Text>
          {showManual ? (
            <>
              <FormInput
                value={rawManual}
                onChangeText={setRawManual}
                placeholder="Paste full UPI link (upi://pay?...)"
                multiline
                autoCorrect={false}
                autoCapitalize="none"
              />
              <PrimaryButton label="Use pasted link" onPress={handleManual} />
            </>
          ) : (
            <SecondaryButton
              label="Enter or paste UPI link instead"
              onPress={() => setShowManual(true)}
            />
          )}
        </Section>
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
  cameraWrap: {
    marginBottom: 12,
  },
  camera: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cameraPlaceholder: {
    width: '100%',
    height: 320,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  hintText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 2,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#334155',
  },
});
