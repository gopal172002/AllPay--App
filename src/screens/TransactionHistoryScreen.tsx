import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Screen, ScreenHeader, Section, StatusPill} from '../components/UI';
import {useAppData} from '../context/AppContext';
import {RootStackParamList} from '../navigation';
import {Filters, Transaction} from '../types';
import {paiseToRupeeLabel} from '../upi/money';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FilterButton = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable style={[styles.filterBtn, active ? styles.filterBtnActive : null]} onPress={onPress}>
    <Text
      style={[styles.filterText, active ? styles.filterTextActive : null]}
      numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

const applyFilters = (items: Transaction[], filters: Filters): Transaction[] => {
  const now = Date.now();
  return items.filter(item => {
    const statusOk = filters.status === 'All' || item.status === filters.status;
    const categoryOk =
      filters.category === 'All' || item.merchant.category === filters.category;
    const dateMs = new Date(item.timestamp).getTime();
    const dateOk =
      filters.dateRange === 'All' ||
      (filters.dateRange === '7d' && now - dateMs <= 7 * 24 * 60 * 60 * 1000) ||
      (filters.dateRange === '30d' && now - dateMs <= 30 * 24 * 60 * 60 * 1000);
    return statusOk && categoryOk && dateOk;
  });
};

export const TransactionHistoryScreen = () => {
  const navigation = useNavigation<Nav>();
  const {transactions, upiPayments} = useAppData();
  const [filters, setFilters] = useState<Filters>({
    status: 'All',
    category: 'All',
    dateRange: 'All',
  });

  const categories = useMemo(
    () => ['All', ...new Set(transactions.map(item => item.merchant.category))],
    [transactions],
  );
  const filtered = useMemo(
    () => applyFilters(transactions, filters),
    [filters, transactions],
  );

  return (
    <Screen safeBottom={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Transaction History"
          subtitle="Track payment records and reimbursement status."
        />
        <Section title="Filters">
          <Text style={styles.filterTitle}>Status</Text>
          <View style={styles.filterWrap}>
            {['All', 'Pending Approval', 'Approved', 'Rejected', 'Flagged', 'Abandoned', 'Recorded'].map(
              option => (
                <FilterButton
                  key={option}
                  label={option}
                  active={filters.status === option}
                  onPress={() => setFilters(prev => ({...prev, status: option as Filters['status']}))}
                />
              ),
            )}
          </View>

          <Text style={styles.filterTitle}>Date range</Text>
          <View style={styles.filterWrap}>
            {['All', '7d', '30d'].map(option => (
              <FilterButton
                key={option}
                label={option}
                active={filters.dateRange === option}
                onPress={() =>
                  setFilters(prev => ({...prev, dateRange: option as Filters['dateRange']}))
                }
              />
            ))}
          </View>

          <Text style={styles.filterTitle}>Category</Text>
          <View style={styles.filterWrap}>
            {categories.map(option => (
              <FilterButton
                key={option}
                label={option}
                active={filters.category === option}
                onPress={() => setFilters(prev => ({...prev, category: option}))}
              />
            ))}
          </View>
        </Section>

        {upiPayments.filter(
          item =>
            item.status === 'UNKNOWN' ||
            item.status === 'PENDING' ||
            item.status === 'UPI_APP_OPENED' ||
            item.status === 'INITIATED',
        ).length ? (
          <Section title="Unresolved UPI payments">
            {upiPayments
              .filter(
                item =>
                  item.status === 'UNKNOWN' ||
                  item.status === 'PENDING' ||
                  item.status === 'UPI_APP_OPENED' ||
                  item.status === 'INITIATED',
              )
              .map(item => (
                <Pressable
                  key={item.id}
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('PaymentResult', {paymentId: item.id})
                  }>
                  <View style={styles.flexOne}>
                    <Text style={styles.merchant} numberOfLines={1}>
                      {item.payeeName}
                    </Text>
                    <Text style={styles.meta}>UPI Intent · not verified</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.amount}>₹{paiseToRupeeLabel(item.amountPaise)}</Text>
                    <StatusPill status={item.status} />
                  </View>
                </Pressable>
              ))}
          </Section>
        ) : null}

        <Section title={`Transactions (${filtered.length})`}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No matching transactions.</Text>
          ) : (
            filtered.map(item => (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() =>
                  navigation.navigate('TransactionDetail', {transactionId: item.id})
                }>
                <View style={styles.flexOne}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant.name}
                  </Text>
                  <Text style={styles.meta}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>INR {item.amount.toFixed(2)}</Text>
                  <StatusPill status={item.status} />
                </View>
              </Pressable>
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
  filterTitle: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 8,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  filterBtn: {
    borderWidth: 1,
    borderColor: '#c7d2e1',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    maxWidth: '100%',
  },
  filterBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#1557d5',
  },
  filterText: {
    color: '#475569',
    fontSize: 12,
  },
  filterTextActive: {
    color: '#1557d5',
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ffffff',
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
    fontSize: 12,
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
  empty: {
    color: '#94a3b8',
  },
});
