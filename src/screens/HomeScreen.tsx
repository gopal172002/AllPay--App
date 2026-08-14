import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {PrimaryButton, Screen, ScreenHeader, Section, StatusPill} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const HomeScreen = () => {
  const navigation = useNavigation<Nav>();
  const {profile, transactions, syncMessage} = useAppData();
  const latest = transactions.slice(0, 3);
  const totalPending = transactions.filter(item => item.status === 'Pending Approval').length;
  const totalRecorded = transactions.filter(item => item.status === 'Recorded').length;
  const totalAmount = transactions.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Screen safeBottom={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title={`Hello, ${profile?.employeeName ?? 'Employee'}`}
          subtitle={`Employee ID ${profile?.employeeId ?? '--'} | ${profile?.department ?? '--'}`}
        />

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue} numberOfLines={1}>
              INR {totalAmount.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>Total spend</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue} numberOfLines={1}>
              {totalRecorded}
            </Text>
            <Text style={styles.metricLabel}>Recorded</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue} numberOfLines={1}>
              {totalPending}
            </Text>
            <Text style={styles.metricLabel}>Pending approval</Text>
          </View>
        </View>

        <Section title="Quick action">
          <PrimaryButton
            label="Scan & Pay"
            onPress={() => navigation.navigate('Scan')}
          />
        </Section>

        {syncMessage ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>{syncMessage}</Text>
          </View>
        ) : null}

        <Section title="Recent transactions">
          {latest.length === 0 ? (
            <Text style={styles.empty}>No transactions yet.</Text>
          ) : (
            latest.map(item => (
              <View style={styles.row} key={item.id}>
                <View style={styles.flexOne}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant.name}
                  </Text>
                  <Text style={styles.meta}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>INR {item.amount.toFixed(2)}</Text>
                  <StatusPill status={item.status} />
                </View>
              </View>
            ))
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
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingVertical: 13,
    paddingHorizontal: 10,
    minHeight: 82,
    justifyContent: 'space-between',
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  syncBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  syncText: {
    color: '#166534',
    fontWeight: '700',
  },
  empty: {
    color: '#94a3b8',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    gap: 12,
  },
  flexOne: {
    flex: 1,
    minWidth: 0,
  },
  merchant: {
    fontWeight: '800',
    color: '#0f172a',
  },
  meta: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: 150,
  },
  amount: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
});
