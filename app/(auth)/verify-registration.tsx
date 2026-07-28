import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { SuccessBanner } from '../../components/ui/SuccessBanner';
import { AuthHeader } from '../../components/auth/AuthHeader';
import { commonStyles } from '../../styles/common';
import { styles } from '../../styles/screens/authForm';

const OTP_REGEX = /^\d{6}$/;

export default function VerifyRegistrationScreen() {
  const router = useRouter();
  const {
    pendingRegistration,
    verifyRegistration,
    resendRegistrationCode,
  } = useAuthStore();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!pendingRegistration) router.replace('/(auth)/register');
  }, [pendingRegistration, router]);

  const handleVerify = async () => {
    setError(null);
    setSuccess(null);

    if (!OTP_REGEX.test(otp)) {
      setError('Verification code must be a 6-digit number.');
      return;
    }

    try {
      setLoading(true);
      await verifyRegistration(otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);

    try {
      setResending(true);
      await resendRegistrationCode();
      setOtp('');
      setSuccess('A new verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (!pendingRegistration) return null;

  const isBusy = loading || resending;

  return (
    <SafeAreaView style={commonStyles.screenWhite} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader
            backLabel="Edit registration details"
            onBack={() => router.replace('/(auth)/register')}
            title="Verify your email"
            subtitle={`Enter the 6-digit code sent to ${pendingRegistration.email}.`}
          />

          <SuccessBanner message={success} />
          <ErrorBanner message={error} />

          <View style={styles.fields}>
            <Input
              label="Verification code"
              icon="shield-checkmark-outline"
              placeholder="6-digit code"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              editable={!isBusy}
              hint="The code expires in 5 minutes. Check your spam folder if needed."
            />
          </View>

          <Button
            label="Verify and create account"
            onPress={handleVerify}
            loading={loading}
            disabled={resending}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />

          <TouchableOpacity
            onPress={handleResend}
            disabled={isBusy}
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel="Resend verification code"
          >
            <Text style={styles.linkText}>
              Didn't receive a code?{' '}
              <Text style={styles.linkHighlight}>{resending ? 'Sending…' : 'Resend code'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
