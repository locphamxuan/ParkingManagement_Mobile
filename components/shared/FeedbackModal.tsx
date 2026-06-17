import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, Colors } from '../../styles/common';
import { SheetModal } from './SheetModal';
import { ErrorBanner } from '../ui/ErrorBanner';
import { submitParkingFeedback, type SubmitFeedbackPayload } from '../../services/feedback';
import { ApiError } from '../../services/api';
import type { ParkingSession } from '../../types';
import { styles } from './FeedbackModal.styles';

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
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>Rate your parking experience</Text>
      <Text style={styles.subtitle}>{sessionLabel}</Text>

      <View style={commonStyles.divider} />

      <Text style={commonStyles.sectionLabel}>SATISFACTION RATING</Text>
      <View style={styles.starsRow}>
        {STAR_VALUES.map((star) => {
          const filled = star <= rating;
          return (
            <TouchableOpacity key={star} onPress={() => handleStarPress(star)} activeOpacity={0.6} style={styles.starBtn}>
              <Ionicons name={filled ? 'star' : 'star-outline'} size={38} color={filled ? Colors.amber : Colors.textDim} />
            </TouchableOpacity>
          );
        })}
        <Text style={styles.ratingLabel}>{rating > 0 ? `${rating}/5` : 'Tap to rate'}</Text>
      </View>

      <View style={commonStyles.divider} />

      <Text style={commonStyles.sectionLabel}>YOUR COMMENT</Text>
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
        <Text style={[styles.counter, comment.length >= 150 && styles.counterWarn]}>{comment.length}/150</Text>
      </View>

      <ErrorBanner message={fieldError} />

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting} activeOpacity={0.7}>
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
    </SheetModal>
  );
}
