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
import { AuthHeader } from "../../components/auth/AuthHeader";
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
            backLabel="Back"
            onBack={() => router.back()}
            title="Reset via SMS"
            subtitle="Enter your phone number and we'll text you a 6-digit code."
          />

          <View style={styles.fields}>
            <Input
              label="Phone number"
              icon="call-outline"
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
            accessibilityRole="button"
          >
            <Text style={styles.linkHighlight}>Back to sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
