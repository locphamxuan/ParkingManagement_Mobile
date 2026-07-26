import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { AuthHeader } from "../../components/auth/AuthHeader";
import { commonStyles } from "../../styles/common";
import { styles } from "../../styles/screens/authForm";
import { resetPasswordSms } from "../../services/auth";

const OTP_REGEX = /^\d{6}$/;

/** Which input an error belongs to — `form` renders a banner above the fields. */
type ErrorField = "form" | "otp" | "newPassword" | "confirmPassword";

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
  const [error, setError] = useState<{ field: ErrorField; message: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errorFor = (field: ErrorField) =>
    error?.field === field ? error.message : undefined;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!phone.trim()) {
      setError({ field: "form", message: "Phone number is missing. Please request an OTP again." });
      return;
    }
    if (!OTP_REGEX.test(otp.trim())) {
      setError({ field: "otp", message: "OTP must be a 6-digit number." });
      return;
    }
    if (!newPassword) {
      setError({ field: "newPassword", message: "New password is required." });
      return;
    }
    if (newPassword.length < 6) {
      setError({ field: "newPassword", message: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ field: "confirmPassword", message: "Passwords do not match." });
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
      setError({
        field: "form",
        message: err instanceof Error ? err.message : "Failed to reset password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={commonStyles.screenWhite} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader
            backLabel="Back to sign in"
            onBack={() => router.replace("/(auth)/login")}
            title="Verify OTP"
            subtitle={`Enter the 6-digit code sent to ${phone || "your phone"} and choose a new password.`}
          />

          <SuccessBanner message={success} />
          <ErrorBanner message={errorFor("form")} />

          <View style={styles.fields}>
            <Input
              label="OTP"
              icon="shield-checkmark-outline"
              placeholder="6-digit code"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              editable={!loading}
              error={errorFor("otp")}
            />
            <Input
              label="New Password"
              icon="lock-closed-outline"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!loading}
              error={errorFor("newPassword")}
            />
            <Input
              label="Confirm Password"
              icon="lock-closed-outline"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
              error={errorFor("confirmPassword")}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
