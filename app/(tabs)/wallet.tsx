import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getWallet, topup, listTransactions, verifyTopup } from '../../services/wallet';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import type { WalletInfo, WalletTransaction } from '../../types';

const MIN_TOPUP = 2_000;
const MAX_TOPUP = 10_000_000;
const TOPUP_PRESETS = [50_000, 100_000, 200_000, 500_000];

function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function txVariant(type: WalletTransaction['type']) {
  if (type === 'topup' || type === 'credit') return 'success';
  if (type === 'refund') return 'info';
  return 'error';
}

function txSign(type: WalletTransaction['type']) {
  return type === 'topup' || type === 'refund' || type === 'credit' ? '+' : '-';
}

function txLabel(type: WalletTransaction['type']) {
  if (type === 'topup' || type === 'credit') return 'Top-up';
  if (type === 'debit') return 'Payment';
  if (type === 'refund') return 'Refund';
  return type;
}

export default function WalletScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Topup modal
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  // Payment link modal
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [orderCode, setOrderCode] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const [w, txs] = await Promise.all([
        getWallet(token),
        listTransactions(token),
      ]);
      setWallet(w);
      setTransactions(txs);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load wallet data');
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleTopup = async () => {
    setTopupError(null);
    const amount = parseInt(topupAmount.replace(/\D/g, ''), 10);

    if (!amount || amount < MIN_TOPUP) {
      setTopupError(`Minimum top-up amount is ${fmtMoney(MIN_TOPUP)}.`);
      return;
    }
    if (amount > MAX_TOPUP) {
      setTopupError(`Maximum top-up amount is ${fmtMoney(MAX_TOPUP)}.`);
      return;
    }

    try {
      setTopupLoading(true);
      const result = await topup(token, amount);
      setShowTopup(false);
      setTopupAmount('');
      setPaymentUrl(result.checkoutUrl);
      setOrderCode(result.orderCode);
      setShowPaymentInfo(true);
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : 'Failed to create top-up request');
    } finally {
      setTopupLoading(false);
    }
  };

  const openPayment = () => {
    if (paymentUrl) Linking.openURL(paymentUrl);
  };

  // Actively reconcile with PayOS — fallback for when the webhook doesn't arrive.
  const handleVerify = async () => {
    if (!orderCode) return;
    setVerifying(true);
    try {
      const res = await verifyTopup(token, orderCode);
      if (res.status === 'success') {
        setShowPaymentInfo(false);
        setPaymentUrl(null);
        setOrderCode(null);
        await load();
        Alert.alert('Top-up Successful', `Your wallet has been credited.\nNew balance: ${fmtMoney(res.balance)}.`);
      } else if (res.status === 'cancelled' || res.status === 'expired') {
        Alert.alert('Payment Not Completed', `This payment was ${res.status}. Please start a new top-up.`);
      } else {
        Alert.alert(
          'Payment Pending',
          'We haven’t received your payment yet. If you just paid, wait a few seconds and tap verify again.',
        );
      }
    } catch (err) {
      Alert.alert('Verification Failed', err instanceof Error ? err.message : 'Could not verify payment.');
    } finally {
      setVerifying(false);
    }
  };

  const closePaymentInfo = async () => {
    // Best-effort reconcile in case the user already paid.
    if (orderCode) {
      try { await verifyTopup(token, orderCode); } catch { /* ignore — manual verify still available */ }
    }
    setShowPaymentInfo(false);
    setPaymentUrl(null);
    setOrderCode(null);
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <Text style={styles.pageTitle}>My Wallet</Text>

        {loadError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} pointerEvents="none" />
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceValue}>
            {wallet !== null ? fmtMoney(wallet.balance) : '—'}
          </Text>
          <Button
            label="Top Up"
            onPress={() => {
              setTopupAmount('');
              setTopupError(null);
              setShowTopup(true);
            }}
            size="md"
            style={styles.topupBtn}
          />
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={Colors.textDim} />
              <Text style={styles.emptyText}>No transactions yet.</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx._id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <Text style={styles.txDesc}>
                    {tx.description || tx.reason || txLabel(tx.type)}
                  </Text>
                  <Text style={styles.txDate}>{fmtDate(tx.createdAt)}</Text>
                </View>
                <View style={styles.txRight}>
                  <Badge label={txLabel(tx.type)} variant={txVariant(tx.type)} />
                  <Text style={[
                    styles.txAmount,
                    { color: txSign(tx.type) === '+' ? Colors.success : Colors.error },
                  ]}>
                    {txSign(tx.type)}{fmtMoney(tx.amount)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* ── Top-up Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showTopup}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopup(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Top Up Wallet</Text>

            <View style={styles.presetRow}>
              {TOPUP_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBtn,
                    topupAmount === String(preset) && styles.presetBtnActive,
                  ]}
                  onPress={() => { setTopupAmount(String(preset)); setTopupError(null); }}
                >
                  <Text style={[
                    styles.presetText,
                    topupAmount === String(preset) && styles.presetTextActive,
                  ]}>
                    {fmtMoney(preset)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.amountInputWrap}>
              <Text style={styles.amountLabel}>Custom Amount (VND)</Text>
              <TextInput
                value={topupAmount}
                onChangeText={(t) => { setTopupAmount(t.replace(/\D/g, '')); setTopupError(null); }}
                placeholder={`Minimum ${fmtMoney(MIN_TOPUP)}`}
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                style={styles.amountInput}
              />
            </View>

            {topupError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                <Text style={styles.errorText}>{topupError}</Text>
              </View>
            ) : null}

            <Text style={styles.payosNote}>
              Powered by PayOS — scan QR code with your banking app
            </Text>

            <View style={styles.modalBtns}>
              <Button
                label="Continue"
                onPress={handleTopup}
                loading={topupLoading}
                size="lg"
                style={{ flex: 1 }}
              />
              <Button
                label="Cancel"
                onPress={() => setShowTopup(false)}
                variant="secondary"
                size="lg"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Payment Link Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showPaymentInfo}
        transparent
        animationType="fade"
        onRequestClose={closePaymentInfo}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { gap: Spacing.lg }]}>
            <View style={styles.modalHandle} />

            <View style={styles.paymentIconWrap}>
              <Ionicons name="qr-code-outline" size={48} color={Colors.primary} />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.modalTitle}>Complete Payment</Text>
              <Text style={styles.paymentDesc}>
                Tap the button below to open the PayOS payment page.{'\n'}
                Scan the QR code with your banking app to complete the transfer.
              </Text>
            </View>

            <View style={styles.paymentInfoBox}>
              <Ionicons name="information-circle-outline" size={15} color={Colors.blue} />
              <Text style={styles.paymentInfoText}>
                After paying, tap “I’ve Completed Payment” to confirm. Your balance usually
                updates automatically, but this guarantees it’s credited.
              </Text>
            </View>

            <View style={{ gap: Spacing.sm }}>
              <Button
                label="Open Payment Page"
                onPress={openPayment}
                size="lg"
              />
              <View style={styles.modalBtns}>
                <Button
                  label={verifying ? 'Verifying...' : 'I’ve Completed Payment'}
                  onPress={handleVerify}
                  loading={verifying}
                  size="lg"
                  style={{ flex: 1 }}
                />
                <Button
                  label="Close"
                  onPress={closePaymentInfo}
                  variant="secondary"
                  size="lg"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 32,
    gap: Spacing.xl,
  },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.text },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing.md,
  },
  errorText: { flex: 1, color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },

  balanceCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    padding: Spacing['2xl'],
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  balanceGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(249,115,22,0.07)',
  },
  balanceLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: FontSize['2xl'],
    fontWeight: '900',
    color: Colors.text,
  },
  topupBtn: { alignSelf: 'flex-start', marginTop: Spacing.xs },

  section: { gap: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: { color: Colors.textDim, fontSize: FontSize.sm },
  txRow: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  txLeft: { flex: 1, gap: 4 },
  txDesc: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  txDate: { fontSize: FontSize.xs, color: Colors.textDim },
  txRight: { alignItems: 'flex-end', gap: 6 },
  txAmount: { fontSize: FontSize.sm, fontWeight: '800', fontFamily: 'monospace' },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing['2xl'],
    paddingBottom: 36,
    gap: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: 'rgba(249,115,22,0.4)',
  },
  presetText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  presetTextActive: { color: Colors.primary },
  amountLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  amountInputWrap: { gap: 4 },
  amountInput: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.text,
    fontSize: FontSize.base,
  },
  payosNote: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },

  paymentIconWrap: { alignItems: 'center', paddingVertical: Spacing.md },
  paymentDesc: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },
  paymentInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.blueBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    padding: Spacing.md,
  },
  paymentInfoText: { flex: 1, fontSize: FontSize.xs, color: Colors.blue, lineHeight: 18 },
});
