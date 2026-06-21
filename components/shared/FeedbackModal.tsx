import { useEffect, useState } from 'react';
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
  Image,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  submitParkingFeedback,
  uploadFeedbackImage,
  type SubmitFeedbackPayload,
} from '../../services/feedback';
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

type ImageField = 'portrait' | 'plate';

export default function FeedbackModal({
  visible,
  session,
  token,
  onClose,
  onSuccess,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [portraitImageUri, setPortraitImageUri] = useState('');
  const [plateImageUri, setPlateImageUri] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setComment('');
      setPortraitImageUri('');
      setPlateImageUri('');
      setFieldError(null);
      setSubmitting(false);
      setUploadingField(null);
    }
  }, [visible]);

  const handleStarPress = (value: number) => {
    setRating(value);
    setFieldError(null);
  };

  const pickImage = async (type: ImageField) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh để chọn ảnh đính kèm.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const assetUri = result.assets[0]?.uri ?? '';
    if (!assetUri) {
      return;
    }

    if (type === 'portrait') {
      setPortraitImageUri(assetUri);
    } else {
      setPlateImageUri(assetUri);
    }
    setFieldError(null);
  };

  const clearImage = (type: ImageField) => {
    if (type === 'portrait') {
      setPortraitImageUri('');
    } else {
      setPlateImageUri('');
    }
  };

  const handleSubmit = async () => {
    setFieldError(null);

    if (!session) {
      setFieldError('Không tìm thấy phiên đỗ xe.');
      return;
    }

    if (rating === 0) {
      setFieldError('Vui lòng chọn số sao đánh giá.');
      return;
    }

    const trimmedComment = comment.trim();
    if (!trimmedComment) {
      setFieldError('Vui lòng nhập nội dung đánh giá.');
      return;
    }
    if (trimmedComment.length > 150) {
      setFieldError('Nội dung đánh giá không được vượt quá 150 ký tự.');
      return;
    }

    setSubmitting(true);

    try {
      // Upload any locally-picked images first to obtain public URLs.
      let portraitImageUrl: string | null = null;
      let plateImageUrl: string | null = null;

      if (portraitImageUri) {
        setUploadingField('portrait');
        portraitImageUrl = await uploadFeedbackImage(token, portraitImageUri);
      }
      if (plateImageUri) {
        setUploadingField('plate');
        plateImageUrl = await uploadFeedbackImage(token, plateImageUri);
      }
      setUploadingField(null);

      const payload: SubmitFeedbackPayload = {
        parkingSessionId: session._id,
        rating,
        comment: trimmedComment,
        portraitImageUrl,
        plateImageUrl,
      };

      const result = await submitParkingFeedback(token, payload);

      if (result) {
        Alert.alert('Thành công', 'Đánh giá của bạn đã được ghi nhận. Cảm ơn bạn đã chia sẻ trải nghiệm!');
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 403 && err.errorCode === 'FEEDBACK_COMPLETED_SESSION_REQUIRED') {
          setFieldError('Phiên gửi xe chưa hoàn thành hoặc không thuộc quyền sở hữu của bạn.');
          return;
        }

        if (err.status === 400 && err.errorCode === 'INVALID_FEEDBACK_RATING') {
          setFieldError('Số sao đánh giá không hợp lệ.');
          return;
        }

        if (err.status === 400 && err.errorCode === 'FEEDBACK_COMMENT_REQUIRED') {
          setFieldError('Vui lòng nhập nội dung đánh giá.');
          return;
        }

        if (err.status === 400 && err.errorCode === 'INVALID_IMAGE_TYPE') {
          setFieldError('Định dạng ảnh không hợp lệ. Vui lòng chọn ảnh jpg, png hoặc webp.');
          return;
        }

        if (err.status === 400 && err.errorCode === 'LIMIT_FILE_SIZE') {
          setFieldError('Ảnh quá lớn (tối đa 8MB). Vui lòng chọn ảnh nhỏ hơn.');
          return;
        }

        if (err.status === 409 && err.errorCode === 'FEEDBACK_ALREADY_EXISTS') {
          setFieldError('Bạn đã đánh giá phiên đỗ xe này rồi.');
          return;
        }

        setFieldError(err.message || 'Gửi đánh giá thất bại. Vui lòng thử lại.');
      } else {
        setFieldError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
      }
    } finally {
      setSubmitting(false);
      setUploadingField(null);
    }
  };

  if (!session) {
    return null;
  }

  const sessionLabel = session.plateNumber
    ? `${session.building?.name ?? 'Bãi xe'} - ${session.plateNumber}`
    : `Phiên đỗ xe #${session._id.slice(-6).toUpperCase()}`;

  const submitLabel = uploadingField
    ? 'ĐANG TẢI ẢNH...'
    : submitting
      ? 'ĐANG GỬI...'
      : 'GỬI ĐÁNH GIÁ';

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

              <Text style={styles.title}>Đánh giá trải nghiệm đỗ xe</Text>
              <Text style={styles.subtitle}>{sessionLabel}</Text>

              <View style={styles.divider} />

              <Text style={styles.label}>SỐ SAO HÀI LÒNG</Text>
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
                <Text style={styles.ratingLabel}>{rating > 0 ? `${rating}/5` : 'Chạm để chọn'}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.label}>NHẬN XÉT CỦA BẠN</Text>
              <View style={styles.textareaWrapper}>
                <TextInput
                  value={comment}
                  onChangeText={(text) => {
                    if (text.length <= 150) {
                      setComment(text);
                      setFieldError(null);
                    }
                  }}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
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

              <View style={styles.divider} />

              <Text style={styles.label}>ĐÍNH KÈM ẢNH (KHÔNG BẮT BUỘC)</Text>
              <View style={styles.imagePickerSection}>
                <View style={styles.imagePickerCard}>
                  <View style={styles.imagePickerHeader}>
                    <View style={styles.imagePickerCopy}>
                      <Text style={styles.imagePickerTitle}>Ảnh chân dung</Text>
                      <Text style={styles.imagePickerSubtitle}>
                        Chọn ảnh từ thư viện để đính kèm.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.pickButton, submitting && styles.pickButtonDisabled]}
                      onPress={() => void pickImage('portrait')}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <Ionicons name="images-outline" size={16} color="#020617" />
                      <Text style={styles.pickButtonText}>Chọn ảnh</Text>
                    </TouchableOpacity>
                  </View>
                  {portraitImageUri ? (
                    <View style={styles.previewRow}>
                      <Image source={{ uri: portraitImageUri }} style={styles.previewThumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => clearImage('portrait')}
                        disabled={submitting}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.error} />
                        <Text style={styles.removeButtonText}>Bỏ ảnh</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>

                <View style={styles.imagePickerCard}>
                  <View style={styles.imagePickerHeader}>
                    <View style={styles.imagePickerCopy}>
                      <Text style={styles.imagePickerTitle}>Ảnh biển số</Text>
                      <Text style={styles.imagePickerSubtitle}>
                        Chọn ảnh rõ biển số để phản ánh chính xác hơn.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.pickButton, submitting && styles.pickButtonDisabled]}
                      onPress={() => void pickImage('plate')}
                      activeOpacity={0.8}
                      disabled={submitting}
                    >
                      <Ionicons name="camera-outline" size={16} color="#020617" />
                      <Text style={styles.pickButtonText}>Chọn ảnh</Text>
                    </TouchableOpacity>
                  </View>
                  {plateImageUri ? (
                    <View style={styles.previewRow}>
                      <Image source={{ uri: plateImageUri }} style={styles.previewThumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => clearImage('plate')}
                        disabled={submitting}
                      >
                        <Ionicons name="close-circle" size={18} color={Colors.error} />
                        <Text style={styles.removeButtonText}>Bỏ ảnh</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
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
                  <Text style={styles.cancelLabel}>ĐỂ SAU</Text>
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
  imagePickerSection: { gap: Spacing.md },
  imagePickerCard: {
    backgroundColor: Colors.cardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  imagePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  imagePickerCopy: { flex: 1 },
  imagePickerTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text },
  imagePickerSubtitle: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  pickButton: {
    minHeight: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  pickButtonDisabled: { opacity: 0.5 },
  pickButtonText: {
    color: '#020617',
    fontSize: FontSize.xs,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  previewThumb: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removeButtonText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '800' },
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
