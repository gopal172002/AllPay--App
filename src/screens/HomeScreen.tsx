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

  return (
    <Screen safeBottom={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title={`Hello, ${profile?.employeeName ?? 'Employee'}`}
          subtitle={`Employee ID ${profile?.employeeId ?? '--'} • ${profile?.department ?? '--'}`}
        />

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{transactions.length}</Text>
            <Text style={styles.metricLabel}>Total transactions</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalRecorded}</Text>
            <Text style={styles.metricLabel}>Recorded</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{totalPending}</Text>
            <Text style={styles.metricLabel}>Pending approval</Text>
          </View>
        </View>

        <Section title="Quick action">
          <PrimaryButton
            label="Scan Merchant QR"
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
                  <Text style={styles.merchant}>{item.merchant.name}</Text>
                  <Text style={styles.meta}>
                    INR {item.amount.toFixed(2)} | {new Date(item.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <StatusPill status={item.status} />
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
    padding: 16,
    flexGrow: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  syncBanner: {
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  flexOne: {
    flex: 1,
  },
  merchant: {
    fontWeight: '700',
    color: '#0f172a',
  },
  meta: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
});
