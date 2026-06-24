import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SuccessBanner } from "../../components/ui/SuccessBanner";
import { commonStyles } from "../../styles/common";
import { styles } from "../../styles/screens/authForm";
import { forgotPassword } from "../../services/auth";
import { Colors, Spacing, Radius, FontSize } from "../../constants/theme";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);

    const emailValue = email.trim();
    if (!emailValue) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_REGEX.test(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    setPendingEmail(emailValue.toLowerCase());
  };

  const handleConfirm = async () => {
    if (!pendingEmail) return;
    const emailToSend = pendingEmail;
    setPendingEmail(null);

    try {
      setLoading(true);
      await forgotPassword(emailToSend);
      setSuccess(`Reset link sent to ${emailToSend}. Check your inbox and spam folder.`);
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

          <View style={commonStyles.card}>
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

            <SuccessBanner message={success} />

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

      {/* Confirmation modal */}
      <Modal
        visible={!!pendingEmail}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingEmail(null)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>Send reset link?</Text>
            <Text style={modalStyles.body}>
              We'll send a password reset link to{"\n"}
              <Text style={modalStyles.emailHighlight}>{pendingEmail}</Text>
              {"\n"}Make sure this email is correct.
            </Text>
            <View style={modalStyles.actions}>
              <TouchableOpacity
                style={[modalStyles.btn, modalStyles.btnCancel]}
                onPress={() => setPendingEmail(null)}
              >
                <Text style={modalStyles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.btn, modalStyles.btnConfirm]}
                onPress={handleConfirm}
              >
                <Text style={modalStyles.btnConfirmText}>Confirm & Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing["2xl"],
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  body: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing["2xl"],
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: Colors.cardAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnCancelText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
  btnConfirm: {
    backgroundColor: Colors.primary,
  },
  btnConfirmText: {
    color: "#ffffff",
    fontSize: FontSize.sm,
    fontWeight: "700",
  },
});
