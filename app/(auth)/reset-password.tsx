import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Colors, FontSize, Radius, Spacing } from "../../constants/theme";
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
    <SafeAreaView style={styles.safe}>
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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Reset password</Text>
            <Text style={styles.cardSub}>
              Create a new password for your account
            </Text>

            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing["2xl"],
    gap: Spacing.xl,
  },
  backBtn: { alignSelf: "flex-start" },
  backText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  brand: { alignItems: "center", gap: Spacing.sm },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(249,115,22,0.15)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 30 },
  brandLabel: {
    fontSize: FontSize.xl,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: 4,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing["2xl"],
    gap: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: "900",
    color: Colors.text,
  },
  cardSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: -Spacing.sm,
  },
  successBox: {
    backgroundColor: Colors.successBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    padding: Spacing.md,
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
  fields: { gap: Spacing.md },
  submitBtn: { marginTop: Spacing.xs },
  note: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    textAlign: "center",
  },
});
