import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { submitParkingFeedback, type SubmitFeedbackPayload } from '../../services/feedback';
import { ApiError } from '../../services/api';
import type { ParkingSession } from '../../types';

interface FeedbackModalProps {
  visible: boolean;
  session: ParkingSession | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function FeedbackModal({
  visible,
  session,
  token,
  onClose,
  onSuccess,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setComment('');
      setFieldError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleStarPress = (value: number) => {
    setRating(value);
    setFieldError(null);
  };

  const handleSubmit = async () => {
    setFieldError(null);

    if (!session) {
      setFieldError('Parking session not found.');
      return;
    }
    if (rating === 0) {
      setFieldError('Please select a star rating.');
      return;
    }
    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setFieldError('Please enter your feedback.');
      return;
    }
    if (trimmedComment.length > 150) {
      setFieldError('Feedback must not exceed 150 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: SubmitFeedbackPayload = {
        parkingSessionId: session._id,
        rating,
        comment: trimmedComment,
        portraitImageUrl: null,
        plateImageUrl: null,
      };

      const result = await submitParkingFeedback(token, payload);

      if (result) {
        Alert.alert('Thank you', 'Your feedback has been recorded. Thanks for sharing your experience!');
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.errorCode === 'FEEDBACK_COMPLETED_SESSION_REQUIRED') {
          setFieldError('This parking session is not completed or does not belong to you.');
          return;
        }
        if (err.status === 400 && err.errorCode === 'INVALID_FEEDBACK_RATING') {
          setFieldError('Invalid star rating.');
          return;
        }
        if (err.status === 400 && err.errorCode === 'FEEDBACK_COMMENT_REQUIRED') {
          setFieldError('Please enter your feedback.');
          return;
        }
        if (err.status === 409 && err.errorCode === 'FEEDBACK_ALREADY_EXISTS') {
          setFieldError('You have already reviewed this parking session.');
          return;
        }
        setFieldError(err.message || 'Failed to submit feedback. Please try again.');
      } else {
        setFieldError('Unable to reach the server. Please check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return null;
  }

  const sessionLabel = session.plateNumber
    ? `${session.building?.name ?? 'Parking lot'} - ${session.plateNumber}`
    : `Parking session #${session._id.slice(-6).toUpperCase()}`;

  const submitLabel = submitting ? 'SUBMITTING…' : 'SUBMIT REVIEW';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </View>

        <View style={styles.sheetContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.sheet}>
              <View style={styles.handleRow}>
                <View style={styles.handle} />
              </View>

              <Text style={styles.title}>Rate your parking experience</Text>
              <Text style={styles.subtitle}>{sessionLabel}</Text>

              <View style={styles.divider} />

              <Text style={styles.label}>SATISFACTION RATING</Text>
              <View style={styles.starsRow}>
                {STAR_VALUES.map((star) => {
                  const filled = star <= rating;
                  return (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleStarPress(star)}
                      activeOpacity={0.6}
                      style={styles.starBtn}
                    >
                      <Ionicons
                        name={filled ? 'star' : 'star-outline'}
                        size={38}
                        color={filled ? Colors.amber : Colors.textDim}
                      />
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.ratingLabel}>{rating > 0 ? `${rating}/5` : 'Tap to rate'}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>YOUR COMMENT</Text>
              <View style={styles.textareaWrapper}>
                <TextInput
                  value={comment}
                  onChangeText={(text) => {
                    if (text.length <= 150) {
                      setComment(text);
                      setFieldError(null);
                    }
                  }}
                  placeholder="Share your experience…"
                  placeholderTextColor={Colors.textDim}
                  multiline
                  numberOfLines={4}
                  style={styles.textarea}
                  maxLength={150}
                  autoCorrect={false}
                />
                <Text style={[styles.counter, comment.length >= 150 && styles.counterWarn]}>
                  {comment.length}/150
                </Text>
              </View>

              {fieldError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.errorText}>{fieldError}</Text>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelLabel}>LATER</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, (submitting || rating === 0) && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting || rating === 0}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <View style={styles.submitInline}>
                      <ActivityIndicator size="small" color="#020617" />
                      <Text style={styles.submitLabel}>{submitLabel}</Text>
                    </View>
                  ) : (
                    <Text style={styles.submitLabel}>{submitLabel}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,6,23,0.7)' },
  sheetContainer: { maxHeight: '85%' },
  scrollContent: { flexGrow: 1 },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  handleRow: { alignItems: 'center', paddingBottom: Spacing.xs },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textDim,
    opacity: 0.4,
  },
  title: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.border },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  starBtn: { padding: Spacing.xs },
  ratingLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    marginLeft: Spacing.sm,
    minWidth: 40,
  },
  textareaWrapper: {
    backgroundColor: Colors.input,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  textarea: {
    color: Colors.text,
    fontSize: FontSize.base,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  counter: {
    textAlign: 'right',
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '700',
    marginTop: 2,
  },
  counterWarn: { color: Colors.error },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cancelLabel: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  submitBtnDisabled: { opacity: 0.5 },
  submitLabel: {
    fontSize: FontSize.xs,
    fontWeight: '900',
    color: '#020617',
    letterSpacing: 1,
  },
});
