import {RouteProp, useRoute} from '@react-navigation/native';
import React, {useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {EXPENSE_PURPOSES} from '../constants/mockData';
import {
  FormInput,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Section,
  SecondaryButton,
  StatusPill,
} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {Receipt} from '../types';
import {isPaymentCaptured} from '../services/payments';
import {toast} from '../utils/toast';

type Route = RouteProp<RootStackParamList, 'TransactionDetail'>;

const FILE_LIMIT_BYTES = 5 * 1024 * 1024;

const isWithin48Hours = (isoDate: string): boolean =>
  Date.now() - new Date(isoDate).getTime() <= 48 * 60 * 60 * 1000;

const normalizeReceipts = (assets: any[]): Receipt[] =>
  assets.map((asset, idx) => ({
    id: `${asset.fileName ?? 'receipt'}-${idx}-${Date.now()}`,
    uri: asset.uri ?? '',
    fileName: asset.fileName ?? `receipt-${idx + 1}.jpg`,
    fileSize: asset.fileSize ?? 0,
    type: asset.type ?? 'image/jpeg',
  }));

const DetailRow = ({label, value}: {label: string; value: string}) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

export const TransactionDetailScreen = () => {
  const route = useRoute<Route>();
  const {
    transactions,
    submitForReimbursement,
    addReceipts,
  } = useAppData();
  const tx = useMemo(
    () => transactions.find(item => item.id === route.params.transactionId),
    [route.params.transactionId, transactions],
  );
  const [purpose, setPurpose] = useState(EXPENSE_PURPOSES[0]);
  const [note, setNote] = useState('');

  if (!tx) {
    return (
      <Screen safeTop={false}>
        <View style={styles.centered}>
          <Text style={styles.notFound}>Transaction not found.</Text>
        </View>
      </Screen>
    );
  }

  const canAttach = isWithin48Hours(tx.timestamp) && tx.receipts.length < 3;
  const paymentReady = isPaymentCaptured(tx.paymentStatus);
  const canSubmit =
    paymentReady && (tx.status === 'Recorded' || tx.status === 'Flagged');
  let submitLabel = 'Already submitted';
  if (!paymentReady) {
    submitLabel = 'Payment not confirmed';
  } else if (canSubmit) {
    submitLabel = 'Submit for reimbursement';
  }

  const attachFromSource = async (source: 'camera' | 'gallery') => {
    const pickerResult =
      source === 'camera'
        ? await launchCamera({mediaType: 'photo', quality: 0.8})
        : await launchImageLibrary({mediaType: 'photo', selectionLimit: 3});

    const assets = pickerResult.assets ?? [];
    const invalid = assets.find(
      asset =>
        !['image/jpeg', 'image/png'].includes(asset.type ?? '') ||
        (asset.fileSize ?? 0) > FILE_LIMIT_BYTES,
    );
    if (invalid) {
      toast.error('Invalid file', 'Use JPEG or PNG, max 5 MB per image.');
      return;
    }
    const receipts = normalizeReceipts(assets);
    await addReceipts(tx.id, receipts);
  };

  const submit = async () => {
    if (note.length > 500) {
      toast.error('Note too long', 'Maximum 500 characters.');
      return;
    }
    await submitForReimbursement(tx.id, purpose, note);
    toast.success('Submitted', 'This expense is now pending approval.');
  };

  return (
    <Screen safeTop={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title={`Transaction ${tx.id}`}
          subtitle={new Date(tx.timestamp).toLocaleString()}
        />
        <StatusPill status={tx.status} />

        <Section title="Payment details">
          <DetailRow label="Merchant" value={tx.merchant.name} />
          <DetailRow label="MCC" value={tx.merchant.mcc} />
          <DetailRow label="UPI Ref ID" value={tx.upiRefId ?? '--'} />
          <DetailRow label="Payment" value={tx.paymentStatus ?? 'Not started'} />
          <DetailRow label="Amount" value={`INR ${tx.amount.toFixed(2)}`} />
          <DetailRow label="UPI App" value={tx.upiApp} />
          <DetailRow label="Sync" value={tx.syncStatus} />
          <DetailRow
            label="Location"
            value={
              tx.location
                ? `${tx.location.latitude.toFixed(4)}, ${tx.location.longitude.toFixed(4)}`
                : 'Not captured'
            }
          />
        </Section>

        <Section title="Receipts (max 3, within 48h)">
          <View style={styles.thumbWrap}>
            {tx.receipts.length === 0 ? <Text style={styles.empty}>No receipts uploaded yet.</Text> : null}
            {tx.receipts.map(receipt => (
              <Image key={receipt.id} source={{uri: receipt.uri}} style={styles.thumb} />
            ))}
          </View>
          {canAttach ? (
            <>
              <SecondaryButton
                label="Attach from camera"
                onPress={() => attachFromSource('camera')}
              />
              <SecondaryButton
                label="Attach from gallery"
                onPress={() => attachFromSource('gallery')}
              />
            </>
          ) : (
            <Text style={styles.helpText}>
              Attachment window closed or maximum receipts reached.
            </Text>
          )}
        </Section>

        <Section title="Submit for reimbursement">
          <Text style={styles.helpText}>Selected purpose: {purpose}</Text>
          <View style={styles.purposeWrap}>
            {EXPENSE_PURPOSES.map(item => (
              <Pressable
                accessibilityRole="button"
                key={item}
                onPress={() => setPurpose(item)}
                style={[
                  styles.purposeChip,
                  purpose === item ? styles.purposeChipActive : null,
                ]}>
                <Text
                  style={[
                    styles.purposeText,
                    purpose === item ? styles.purposeTextActive : null,
                  ]}
                  numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <FormInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            placeholder="Add note (max 500 chars)"
            editable={canSubmit}
          />
          <PrimaryButton
            label={submitLabel}
            onPress={submit}
            disabled={!canSubmit}
          />
        </Section>

        {tx.status === 'Approved' ? (
          <Section title="Approval info">
            <Text style={styles.row}>
              Reimbursed: INR {tx.reimbursementAmount?.toFixed(2) ?? '--'}
            </Text>
            <Text style={styles.row}>
              Date: {tx.reimbursementDate ? new Date(tx.reimbursementDate).toLocaleDateString() : '--'}
            </Text>
          </Section>
        ) : null}

        {tx.status === 'Rejected' ? (
          <Section title="Rejected reason">
            <Text style={styles.row}>{tx.rejectionReason ?? tx.adminNote ?? 'Not provided'}</Text>
          </Section>
        ) : null}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    color: '#334155',
    fontWeight: '600',
  },
  row: {
    color: '#1e293b',
    marginBottom: 6,
  },
  detailRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    paddingBottom: 10,
    marginBottom: 10,
  },
  detailLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  thumbWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#cbd5e1',
    borderWidth: 1,
    borderColor: '#dbe3ee',
  },
  empty: {
    color: '#94a3b8',
    width: '100%',
  },
  helpText: {
    color: '#64748b',
    marginBottom: 8,
    lineHeight: 20,
  },
  purposeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  purposeChip: {
    borderWidth: 1,
    borderColor: '#c7d2e1',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    maxWidth: '100%',
  },
  purposeChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#1557d5',
  },
  purposeText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  purposeTextActive: {
    color: '#1557d5',
    fontWeight: '800',
  },
});
