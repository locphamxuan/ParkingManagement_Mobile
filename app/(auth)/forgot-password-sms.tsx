import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { commonStyles } from "../../styles/common";
import { styles } from "../../styles/screens/authForm";
import { requestPasswordResetSms } from "../../services/auth";

const PHONE_REGEX = /^[0-9+\-\s()]{8,20}$/;

export default function ForgotPasswordSmsScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    const phoneValue = phone.trim();
    if (!phoneValue) {
      setError("Phone number is required.");
      return;
    }
    if (!PHONE_REGEX.test(phoneValue)) {
      setError("Please enter a valid phone number.");
      return;
    }

    try {
      setLoading(true);
      await requestPasswordResetSms(phoneValue);
      router.push({
        pathname: "/(auth)/reset-password-sms",
        params: { phone: phoneValue },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send OTP. Please try again.",
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
            <Text style={styles.cardTitle}>Forgot password (SMS)</Text>
            <Text style={styles.cardSub}>
              Enter your phone number to receive an OTP
            </Text>

            <View style={styles.fields}>
              <Input
                label="Phone number"
                placeholder="0901234567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                error={error ?? undefined}
                editable={!loading}
                hint="We'll send a 6-digit OTP to this phone number via SMS."
              />
            </View>

            <Button
              label="Send OTP"
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
