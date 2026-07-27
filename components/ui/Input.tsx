import { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  hint?: string;
  autoCorrect?: boolean;
  /** Optional leading Ionicon (mail-outline, lock-closed-outline, …). */
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  editable = true,
  multiline = false,
  numberOfLines,
  style,
  inputStyle,
  hint,
  autoCorrect = false,
  icon,
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const isSecure = secureTextEntry && !visible;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputRow,
          multiline && styles.inputRowMultiline,
          focused && styles.inputFocused,
          !editable && styles.disabled,
          error ? styles.inputError : null,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? Colors.primary : Colors.textDim}
            style={styles.leadingIcon}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDim}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCorrect={autoCorrect}
          accessibilityLabel={label ?? placeholder}
          style={[
            styles.input,
            multiline && { height: (numberOfLines ?? 3) * 22, textAlignVertical: 'top', paddingTop: 12 },
            inputStyle,
          ]}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setVisible((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={19} color={Colors.textDim} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={13} color={Colors.error} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputRowMultiline: { alignItems: 'flex-start', paddingVertical: 4 },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.primaryTint },
  disabled: { backgroundColor: Colors.cardAlt, opacity: 0.7 },
  inputError: { borderColor: Colors.error, backgroundColor: Colors.errorBg },
  leadingIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.base,
    paddingVertical: 0,
  },
  eyeBtn: { paddingLeft: Spacing.sm, paddingVertical: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  error: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '500',
  },
});
