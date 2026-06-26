import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/authStore';
import { getWallet, topup, listTransactions, verifyTopup } from '../../services/wallet';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { styles } from '../../styles/screens/wallet';
import type { WalletInfo, WalletTransaction, TopupResult } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { useUIStore } from '../../store/uiStore';



function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(15);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 60, withTiming(0, { duration: 400 }));
  }, [index]);

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}


const MIN_TOPUP = 2_000;
const MAX_TOPUP = 10_000_000;
const TOPUP_PRESETS = [50_000, 100_000, 200_000, 500_000];

function fmtMoney(n: number) {
  return `${n.toLocaleString('en-US')} VND`;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', {
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

  // Date range state
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);


  // Topup modal
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  // Payment link modal
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [orderCode, setOrderCode] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [topupResult, setTopupResult] = useState<TopupResult | null>(null);

  const setTabBarHidden = useUIStore((state) => state.setTabBarHidden);

  useEffect(() => {
    setTabBarHidden(showTopup || showPaymentInfo);
    return () => setTabBarHidden(false);
  }, [showTopup, showPaymentInfo, setTabBarHidden]);

  // Custom Alert / Confirm Dialog State
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'error' | 'success';
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const showCustomAlert = useCallback((title: string, message: string, onConfirm?: () => void, type: 'alert' | 'error' | 'success' = 'alert') => {
    setDialog({
      visible: true,
      title,
      message,
      type,
      onConfirm: () => {
        setDialog((d) => ({ ...d, visible: false }));
        onConfirm?.();
      },
      confirmText: 'OK',
    });
  }, []);



  // Floating animation for wallet card
  const walletFloat = useSharedValue(0);
  useEffect(() => {
    walletFloat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200 }),
        withTiming(0, { duration: 2200 })
      ),
      -1,
      true
    );
  }, []);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const floatY = -5 * walletFloat.value;
    return {
      transform: [
        { perspective: 1000 },
        { translateY: floatY },
        { rotateX: `${1.2 * walletFloat.value}deg` },
        { rotateY: `${-1.2 * walletFloat.value}deg` }
      ],
    };
  });

  const getBankName = (bin?: string) => {
    if (!bin) return '—';
    if (bin === '970422') return 'MB Bank (Military Bank)';
    return `Bank (BIN: ${bin})`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showCustomAlert('Copied', `${label} copied to clipboard!`, undefined, 'success');
  };

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
      setTopupResult(result);
      setOrderCode(result.orderCode);
      setShowPaymentInfo(true);
    } catch (err) {
      setTopupError(err instanceof Error ? err.message : 'Failed to create top-up request');
    } finally {
      setTopupLoading(false);
    }
  };

  // Actively reconcile with PayOS — fallback for when the webhook doesn't arrive.
  const handleVerify = async () => {
    if (!orderCode) return;
    setVerifying(true);
    try {
      const res = await verifyTopup(token, orderCode);
      if (res.status === 'success') {
        setShowPaymentInfo(false);
        setOrderCode(null);
        setTopupResult(null);
        await load();
        showCustomAlert('Top-up Successful', `Your wallet has been credited.\nNew balance: ${fmtMoney(res.balance)}.`, undefined, 'success');
      } else if (res.status === 'cancelled' || res.status === 'expired') {
        showCustomAlert('Payment Not Completed', `This payment was ${res.status}. Please start a new top-up.`, undefined, 'error');
      } else {
        showCustomAlert(
          'Payment Pending',
          'We haven’t received your payment yet. If you just paid, wait a few seconds and tap verify again.',
          undefined,
          'alert'
        );
      }
    } catch (err) {
      showCustomAlert('Verification Failed', err instanceof Error ? err.message : 'Could not verify payment.', undefined, 'error');
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
    setOrderCode(null);
    setTopupResult(null);
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
        <Animated.View style={[styles.balanceCard, cardAnimatedStyle]}>
          <View style={styles.cardBody}>
            <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
            <Text style={styles.balanceValue}>
              {wallet !== null ? fmtMoney(wallet.balance) : '—'}
            </Text>
          </View>

          <View style={styles.cardFooterRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
              <Text style={styles.cardHolderName} numberOfLines={1}>
                {session?.displayName ? session.displayName.toUpperCase() : (session?.email ? session.email.split('@')[0].toUpperCase() : 'PBMS MEMBER')}
              </Text>
            </View>
            <Button
              label="Top Up"
              onPress={() => {
                setTopupAmount('');
                setTopupError(null);
                setShowTopup(true);
              }}
              size="md"
              style={[styles.topupBtn, { minHeight: 34, height: 34, paddingHorizontal: 16 }]}
            />
          </View>
        </Animated.View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={setFromDate}
            onToChange={setToDate}
          />

          {(() => {
            const filteredTransactions = transactions.filter((tx) => {
              if (!fromDate) return true;
              const end = toDate ?? new Date();
              const startOfDay = new Date(fromDate);
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date(end);
              endOfDay.setHours(23, 59, 59, 999);
              const d = new Date(tx.createdAt);
              return d >= startOfDay && d <= endOfDay;
            });

            if (filteredTransactions.length === 0) {
              return (
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={32} color={Colors.textDim} />
                  <Text style={styles.emptyText}>
                    {transactions.length === 0 ? 'No transactions yet.' : 'No transactions found in this date range.'}
                  </Text>
                </View>
              );
            }

            return filteredTransactions.map((tx, idx) => (
              <AnimatedCard key={tx._id} index={idx}>
                <View style={styles.txRow}>
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
              </AnimatedCard>
            ));
          })()}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalSubTitle}>BANKING PAYMENT</Text>
                <Text style={styles.modalTitle}>Wallet Top-Up</Text>
              </View>
              <TouchableOpacity onPress={closePaymentInfo} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.paymentInstructions}>
              Open your Banking app to scan the QR code below, or copy the transfer details to complete the transaction.
            </Text>

            <View style={styles.paymentContentRow}>
              <View style={styles.qrColumn}>
                <View style={styles.qrImageContainer}>
                  {topupResult ? (
                    <Image
                      source={{
                        uri: `https://img.vietqr.io/image/${topupResult.bin}-${topupResult.accountNumber}-qr_only.png?amount=${topupResult.amount}&addInfo=${encodeURIComponent(topupResult.description ?? '')}&accountName=${encodeURIComponent(topupResult.accountName ?? '')}`,
                      }}
                      style={styles.payQrImage}
                      resizeMode="contain"
                    />
                  ) : null}
                </View>
                <Text style={styles.waitingStatusText}>
                  <Text style={{ color: Colors.primary }}>● </Text>WAITING FOR PAYMENT...
                </Text>
              </View>

              <View style={styles.detailsColumn}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>BENEFICIARY BANK</Text>
                  <Text style={styles.detailValue}>{getBankName(topupResult?.bin)}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>ACCOUNT NUMBER</Text>
                  <View style={styles.copyValueRow}>
                    <Text style={styles.detailValueMonospace} numberOfLines={1}>
                      {topupResult?.accountNumber || '—'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(topupResult?.accountNumber ?? '', 'Account number')}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy-outline" size={15} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>ACCOUNT HOLDER</Text>
                  <Text style={styles.detailValue}>{topupResult?.accountName || '—'}</Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>AMOUNT</Text>
                  <View style={styles.copyValueRow}>
                    <Text style={[styles.detailValueMonospace, { color: Colors.primary, fontWeight: '900' }]} numberOfLines={1}>
                      {topupResult?.amount ? fmtMoney(topupResult.amount) : '—'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(String(topupResult?.amount ?? ''), 'Amount')}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy-outline" size={15} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>TRANSFER CONTENT</Text>
                  <View style={styles.copyValueRow}>
                    <Text style={styles.detailValueMonospace} numberOfLines={1}>
                      {topupResult?.description || '—'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(topupResult?.description ?? '', 'Description')}
                      style={styles.copyBtn}
                    >
                      <Ionicons name="copy-outline" size={15} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.cautionBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.warning} style={{ marginTop: 2 }} />
              <Text style={styles.cautionText}>
                Note: Please scan the QR code or enter the exact transfer details (especially Amount and Content) for the system to credit your balance automatically.
              </Text>
            </View>

            <View style={styles.actionButtonsRow}>
              <Button
                label={verifying ? 'Verifying...' : 'VERIFY PAYMENT'}
                onPress={handleVerify}
                loading={verifying}
                size="md"
                style={styles.confirmPayBtn}
                textStyle={{ fontSize: FontSize.xs }}
              />
              <Button
                label="Cancel"
                onPress={closePaymentInfo}
                variant="secondary"
                size="md"
                style={styles.cancelPayBtn}
                textStyle={{ fontSize: FontSize.xs }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Custom Dialog Modal ────────────────────────────────────────────────── */}
      <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={() => setDialog(d => ({ ...d, visible: false }))}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogIconContainer}>
              {dialog.type === 'success' && <Ionicons name="checkmark-circle" size={42} color={Colors.success} />}
              {dialog.type === 'error' && <Ionicons name="alert-circle" size={42} color={Colors.error} />}
              {dialog.type === 'confirm' && <Ionicons name="warning" size={42} color={Colors.amber} />}
              {dialog.type === 'alert' && <Ionicons name="information-circle" size={42} color={Colors.primary} />}
            </View>

            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[
                  styles.dialogBtn,
                  dialog.type === 'confirm' ? styles.dialogBtnConfirmDanger : styles.dialogBtnConfirmPrimary
                ]}
                onPress={dialog.onConfirm}
              >
                <Text style={styles.dialogBtnConfirmText}>{dialog.confirmText || 'OK'}</Text>
              </TouchableOpacity>
              {dialog.type === 'confirm' && (
                <TouchableOpacity style={[styles.dialogBtn, styles.dialogBtnCancel]} onPress={dialog.onCancel}>
                  <Text style={styles.dialogBtnCancelText}>{dialog.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
