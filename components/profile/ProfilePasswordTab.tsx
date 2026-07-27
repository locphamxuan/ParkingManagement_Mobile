import { View, Text } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { styles } from '../../styles/screens/profile';

interface ProfilePasswordTabProps {
  currentPw: string;
  setCurrentPw: (v: string) => void;
  newPw: string;
  setNewPw: (v: string) => void;
  confirmPw: string;
  setConfirmPw: (v: string) => void;
  pwError: string | null;
  pwSuccess: string | null;
  savingPw: boolean;
  onSubmit: () => void;
}

/** Tab "Change Password" của màn Profile. */
export function ProfilePasswordTab({
  currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
  pwError, pwSuccess, savingPw, onSubmit,
}: ProfilePasswordTabProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Change Password</Text>

      <View style={styles.formFields}>
        <Input
          label="Current Password"
          value={currentPw}
          onChangeText={setCurrentPw}
          secureTextEntry
          placeholder="Your current password"
        />
        <Input
          label="New Password"
          value={newPw}
          onChangeText={setNewPw}
          secureTextEntry
          placeholder="At least 6 characters"
        />
        <Input
          label="Confirm New Password"
          value={confirmPw}
          onChangeText={setConfirmPw}
          secureTextEntry
          placeholder="Repeat new password"
        />

        {pwError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{ pwError}</Text>
          </View>
        ) : null}

        {pwSuccess ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{ pwSuccess}</Text>
          </View>
        ) : null}

        <Button
          label="Change Password"
          onPress={onSubmit}
          loading={savingPw}
          size="md"
        />
      </View>
    </View>
  );
}
