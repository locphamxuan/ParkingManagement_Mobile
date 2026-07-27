import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../store/authStore';
import { getWallet, topup, listTransactions, verifyTopup } from '../../services/wallet';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Colors, FontSize, Gradients, Radius } from '../../constants/theme';
import { GradientView } from '../../components/ui/GradientView';
import { styles } from '../../styles/screens/wallet';
import { fmtMoney, fmtDate, txVariant, txSign, txLabel } from '../../utils/walletHelpers';
import { WalletDialog } from '../../components/wallet/WalletDialog';
import type { WalletInfo, WalletTransaction, TopupResult } from '../../types';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { useUIStore } from '../../store/uiStore';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import {
  clearPendingTopupOrder,
  getPendingTopupOrder,
  isTerminalTopupStatus,
  savePendingTopupOrder,
} from '../../services/pendingTopup';
import { resolveErrorMessage } from '../../utils/apiErrors';





const MIN_TOPUP = 2_000;
const MAX_TOPUP = 10_000_000;
const TOPUP_PRESETS = [50_000, 100_000, 200_000, 500_000];

// Helpers moved to ./wallet.utils; Dialog to components/wallet/WalletDialog

export default function WalletScreen() {
  const { session } = useAuthStore();
  const token = session?.token ?? '';
  const userId = session?.userId ?? '';

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
  const autoReconciledOrder = useRef<number | null>(null);

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
      setLoadError(resolveErrorMessage(err, 'Failed to load wallet data.'));
    }
  }, [token]);

  const clearPendingOrder = useCallback(async () => {
    if (userId) {
      try {
        await clearPendingTopupOrder(userId);
      } catch {
        // Re-verifying an idempotent terminal order on the next restore is safe.
      }
    }
    autoReconciledOrder.current = null;
    setShowPaymentInfo(false);
    setOrderCode(null);
    setTopupResult(null);
  }, [userId]);

  const reconcileOrder = useCallback(async (
    pendingOrderCode: number,
    notifyUser: boolean,
  ) => {
    const result = await verifyTopup(token, pendingOrderCode);

    if (isTerminalTopupStatus(result.status)) {
      await clearPendingOrder();
    } else {
      setOrderCode(pendingOrderCode);
    }

    if (result.status === 'success') {
      await load();
      if (notifyUser) {
        showCustomAlert(
          'Top-up Successful',
          `Your wallet has been credited.\nNew balance: ${fmtMoney(result.balance)}.`,
          undefined,
          'success',
        );
      }
    } else if (result.status === 'cancelled' || result.status === 'expired') {
      if (notifyUser) {
        showCustomAlert(
          'Payment Not Completed',
          `This payment was ${result.status}. Please start a new top-up.`,
          undefined,
          'error',
        );
      }
    } else if (notifyUser) {
      showCustomAlert(
        'Payment Pending',
        'We have not received your payment yet. If you just paid, wait a few seconds and verify again.',
        undefined,
        'alert',
      );
    }

    return result;
  }, [clearPendingOrder, load, showCustomAlert, token]);

  const restorePendingOrder = useCallback(async () => {
    if (!token || !userId) return;
    try {
      const storedOrderCode = await getPendingTopupOrder(userId);
      if (!storedOrderCode) return;
      setOrderCode(storedOrderCode);

      if (autoReconciledOrder.current === storedOrderCode) return;
      autoReconciledOrder.current = storedOrderCode;
      await reconcileOrder(storedOrderCode, false);
    } catch {
      // Keep the order stored for a later retry after temporary storage/network failures.
    }
  }, [reconcileOrder, token, userId]);

  useFocusEffect(useCallback(() => {
    void load();
    void restorePendingOrder();
  }, [load, restorePendingOrder]));

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
      if (userId) {
        try {
          await savePendingTopupOrder(userId, result.orderCode);
        } catch {
          showCustomAlert(
            'Recovery Warning',
            'The payment was created, but this device could not save it for automatic recovery. Keep this screen open until payment is verified.',
            undefined,
            'alert',
          );
        }
      }
      setShowPaymentInfo(true);
    } catch (err) {
      setTopupError(resolveErrorMessage(err, 'Failed to create top-up request.'));
    } finally {
      setTopupLoading(false);
    }
  };

  // Actively reconcile with PayOS — fallback for when the webhook doesn't arrive.
  const handleVerify = async () => {
    if (!orderCode) return;
    setVerifying(true);
    try {
      await reconcileOrder(orderCode, true);
    } catch (err) {
      showCustomAlert(
        'Verification Failed',
        resolveErrorMessage(err, 'Could not verify payment.'),
        undefined,
        'error',
      );
    } finally {
      setVerifying(false);
    }
  };

  const dismissPendingTopup = useCallback(async () => {
    if (!orderCode) return;

    setVerifying(true);
    try {
      // Check once before dropping the local reminder, so a payment completed in
      // another banking app is credited before the user starts another top-up.
      await reconcileOrder(orderCode, false);
    } catch {
      // A connection issue must not leave the wallet locked. The bank order is
      // unaffected; this action only removes the reminder stored on this device.
    } finally {
      await clearPendingOrder();
      setVerifying(false);
    }
  }, [clearPendingOrder, orderCode, reconcileOrder]);

  const requestDismissPendingTopup = () => {
    setDialog({
      visible: true,
      title: 'Dismiss pending top-up?',
      message: 'We will check the payment once more, then remove this reminder from this device. This does not cancel a bank transfer that was already created.',
      type: 'confirm',
      confirmText: 'Dismiss reminder',
      cancelText: 'Keep waiting',
      onConfirm: () => {
        setDialog((current) => ({ ...current, visible: false }));
        void dismissPendingTopup();
      },
      onCancel: () => setDialog((current) => ({ ...current, visible: false })),
    });
  };

  const closePaymentInfo = async () => {
    // Best-effort reconcile in case the user already paid.
    if (orderCode) {
      try {
        await reconcileOrder(orderCode, false);
      } catch {
        // Keep the persisted order so the user can verify it later.
      }
    }
    setShowPaymentInfo(false);
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

        {orderCode && !showPaymentInfo ? (
          <View style={styles.pendingTopupCard}>
            <View style={styles.pendingTopupCopy}>
              <Text style={styles.pendingTopupTitle}>Pending wallet top-up</Text>
              <Text style={styles.pendingTopupText}>
                Order #{orderCode} is waiting for payment. You can verify it or dismiss this device reminder.
              </Text>
            </View>
            <View style={styles.pendingTopupActions}>
              <Button
                label={verifying ? 'Checking...' : 'Verify'}
                onPress={handleVerify}
                loading={verifying}
                size="sm"
              />
              <TouchableOpacity
                style={styles.dismissPendingButton}
                onPress={requestDismissPendingTopup}
                disabled={verifying}
                accessibilityRole="button"
                accessibilityLabel="Dismiss pending top-up reminder"
                accessibilityState={{ disabled: verifying }}
              >
                <Text style={styles.dismissPendingText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Balance card */}
        <View>
          <GradientView colors={Gradients.navy} direction="diagonal" borderRadius={Radius.xl} style={styles.balanceCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardChip}>
                <Ionicons name="card-outline" size={18} color={Colors.navy} />
              </View>
              <Text style={styles.balanceLabel}>Current balance</Text>
            </View>

            <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
              {wallet !== null ? fmtMoney(wallet.balance) : '—'}
            </Text>

            <View style={styles.cardFooterRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHolderLabel}>CARDHOLDER</Text>
                <Text style={styles.cardHolderName} numberOfLines={1}>
                  {session?.displayName ? session.displayName.toUpperCase() : (session?.email ? session.email.split('@')[0].toUpperCase() : 'PBMS MEMBER')}
                </Text>
              </View>
              <View style={styles.brandBadge}>
                <Text style={styles.brandText}>P</Text>
              </View>
            </View>

            <Button
              label={orderCode ? 'Top-up pending' : 'Top Up'}
              onPress={() => {
                setTopupAmount('');
                setTopupError(null);
                setShowTopup(true);
              }}
              disabled={Boolean(orderCode)}
              variant="accent"
              size="lg"
              fullWidth
            />
          </GradientView>
        </View>

        {/* Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>

          <View style={styles.filterCard}>
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromChange={setFromDate}
              onToChange={setToDate}
            />
          </View>

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

            return filteredTransactions.map((tx, idx) => {
              const isCredit = txSign(tx.type) === '+';
              const amountColor = isCredit ? Colors.success : Colors.error;
              return (
                <AnimatedCard key={tx._id} index={idx}>
                  <View style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: isCredit ? Colors.successBg : Colors.errorBg }]}>
                      <Ionicons
                        name={isCredit ? 'arrow-down' : 'arrow-up'}
                        size={18}
                        color={amountColor}
                      />
                    </View>
                    <View style={styles.txLeft}>
                      <Text style={styles.txDesc} numberOfLines={2}>
                        {tx.description || tx.reason || txLabel(tx.type)}
                      </Text>
                      <Text style={styles.txDate}>{fmtDate(tx.createdAt)}</Text>
                    </View>
                    <View style={styles.txRight}>
                      <Badge label={txLabel(tx.type)} variant={txVariant(tx.type)} />
                      <Text style={[styles.txAmount, { color: amountColor }]}>
                        {txSign(tx.type)}{fmtMoney(tx.amount)}
                      </Text>
                    </View>
                  </View>
                </AnimatedCard>
              );
            });
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
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalSubTitle}>WALLET TOP-UP</Text>
                <Text style={styles.modalTitle}>Add funds</Text>
                <Text style={styles.topupSubtitle}>Choose an amount, then create a secure PayOS payment QR.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowTopup(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close top-up"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Popular amounts</Text>
            <View style={styles.presetRow}>
              {TOPUP_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBtn,
                    topupAmount === String(preset) && styles.presetBtnActive,
                  ]}
                  onPress={() => { setTopupAmount(String(preset)); setTopupError(null); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: topupAmount === String(preset) }}
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
              <Text style={styles.amountLabel}>Or enter a custom amount (VND)</Text>
              <TextInput
                value={topupAmount}
                onChangeText={(t) => { setTopupAmount(t.replace(/\D/g, '')); setTopupError(null); }}
                placeholder={`Minimum ${fmtMoney(MIN_TOPUP)}`}
                placeholderTextColor={Colors.textDim}
                keyboardType="numeric"
                accessibilityLabel="Custom top-up amount in VND"
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
                label="Create payment QR"
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
          <View style={[styles.modalSheet, styles.paymentSheet]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalSubTitle}>BANKING PAYMENT</Text>
                <Text style={styles.modalTitle}>Wallet Top-Up</Text>
              </View>
              <TouchableOpacity onPress={closePaymentInfo} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.paymentScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.paymentScroll}
            >
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
                label={verifying ? 'Verifying...' : 'Check status'}
                onPress={handleVerify}
                loading={verifying}
                size="md"
                style={styles.confirmPayBtn}
                textStyle={{ fontSize: FontSize.xs }}
              />
              <Button
                label="Close"
                onPress={closePaymentInfo}
                variant="secondary"
                size="md"
                style={styles.cancelPayBtn}
                textStyle={{ fontSize: FontSize.xs }}
              />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <WalletDialog dialog={dialog} onRequestClose={() => setDialog(d => ({ ...d, visible: false }))} />
    </SafeAreaView>
  );
}
