import { useMemo, useState } from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Text,
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
import { resetPassword } from "../../services/auth";
import { findPasswordWeakness } from "../../utils/passwordPolicy";

/** Which input an error belongs to — `form` renders a banner above the fields. */
type ErrorField = "form" | "newPassword" | "confirmPassword";

function getTokenValue(tokenParam: string | string[] | undefined): string {
  if (Array.isArray(tokenParam)) {
    return tokenParam[0] ?? "";
  }
  return tokenParam ?? "";
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => getTokenValue(params.token), [params.token]);

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

    if (!token.trim()) {
      setError({
        field: "form",
        message: "Reset token is missing. Please open the link from your email again.",
      });
      return;
    }
    if (!newPassword) {
      setError({ field: "newPassword", message: "New password is required." });
      return;
    }
    const weakness = findPasswordWeakness(newPassword);
    if (weakness) {
      setError({ field: "newPassword", message: weakness });
      return;
    }
    if (newPassword !== confirmPassword) {
      setError({ field: "confirmPassword", message: "Passwords do not match." });
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token.trim(), newPassword);
      setSuccess(
        "Password reset successfully. You can now sign in with your new password.",
      );
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
            title="Reset password"
            subtitle="Create a new password for your account."
          />

          <SuccessBanner message={success} />
          <ErrorBanner message={errorFor("form")} />

          <View style={styles.fields}>
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
