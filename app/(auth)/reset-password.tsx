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
import { resetPassword } from "../../services/auth";

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!token.trim()) {
      setError(
        "Reset token is missing. Please open the link from your email again.",
      );
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
      await resetPassword(token.trim(), newPassword);
      setSuccess(
        "Password reset successfully. You can now sign in with your new password.",
      );
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
            <Text style={styles.cardTitle}>Reset password</Text>
            <Text style={styles.cardSub}>
              Create a new password for your account
            </Text>

            <SuccessBanner message={success} />

            <View style={styles.fields}>
              <Input
                label="New Password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                error={error ?? undefined}
              />
              <Input
                label="Confirm Password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
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

            <Text style={styles.note}>
              Token preview: {token ? `${token.slice(0, 8)}...` : "missing"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
