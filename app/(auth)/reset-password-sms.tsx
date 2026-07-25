import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { commonStyles } from "../../styles/common";
import { styles } from "../../styles/screens/authForm";
import { resetPasswordSms } from "../../services/auth";

const OTP_REGEX = /^\d{6}$/;

function getParamValue(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? "";
  return param ?? "";
}

export default function ResetPasswordSmsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = useMemo(() => getParamValue(params.phone), [params.phone]);

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!phone.trim()) {
      setError("Phone number is missing. Please request an OTP again.");
      return;
    }
    if (!OTP_REGEX.test(otp.trim())) {
      setError("OTP must be a 6-digit number.");
      return;
    }
    if (!newPassword) {
      setError("New password is required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await resetPasswordSms(phone.trim(), otp.trim(), newPassword);
      setSuccess(
        "Password reset successfully. You can now sign in with your new password.",
      );
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => router.replace("/(auth)/login"), 1400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back to sign in</Text>
          </TouchableOpacity>

          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>P</Text>
            </View>
            <Text style={styles.brandLabel}>PBMS</Text>
          </View>

          <View style={commonStyles.card}>
            <Text style={styles.cardTitle}>Verify OTP</Text>
            <Text style={styles.cardSub}>
              Enter the OTP sent to {phone || "your phone"} and choose a new
              password
            </Text>

            <SuccessBanner message={success} />

            <View style={styles.fields}>
              <Input
                label="OTP"
                placeholder="6-digit code"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                error={error ?? undefined}
                editable={!loading}
              />
              <Input
                label="New Password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!loading}
              />
              <Input
                label="Confirm Password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <Button
              label="Reset password"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
