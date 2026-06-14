import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Colors, FontSize, Radius, Spacing } from "../../constants/theme";
import { forgotPassword } from "../../services/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    const emailValue = email.trim();
    if (!emailValue) {
      setError("Email is required.");
      return;
    }

    const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
    if (!EMAIL_REGEX.test(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(emailValue.toLowerCase());
      setSuccess(
        "Password reset email sent. Please check your inbox.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send reset link. Please try again.",
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
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.brand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoEmoji}>P</Text>
            </View>
            <Text style={styles.brandLabel}>PBMS</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot password</Text>
            <Text style={styles.cardSub}>
              Enter your email to receive a reset link
            </Text>

            <View style={styles.fields}>
              <Input
                label="Email"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                error={error ?? undefined}
                editable={!loading}
                hint="We'll send a token-based reset link to this email address."
              />
            </View>

            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            <Button
              label="Send reset link"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity
              onPress={() => router.push("/(auth)/login")}
              style={styles.link}
            >
              <Text style={styles.linkText}>
                Remembered your password?{" "}
                <Text style={styles.linkHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>
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
  fields: { gap: Spacing.md },
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
  submitBtn: { marginTop: Spacing.xs },
  link: { alignItems: "center" },
  linkText: { color: Colors.textMuted, fontSize: FontSize.sm },
  linkHighlight: { color: Colors.primary, fontWeight: "700" },
});
