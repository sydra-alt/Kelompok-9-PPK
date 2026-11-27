import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { FeedbackType } from '@/components/FeedbackBanner';

interface FeedbackContent {
  type: FeedbackType;
  title: string;
  message: string;
  testID?: string;
  onClose?: () => void;
}

interface ActiveFeedback extends FeedbackContent {
  id: string;
  revision: number;
  phase: 'visible' | 'closing';
  notifyOnClose: boolean;
}

interface FeedbackToastContextValue {
  present: (id: string, content: FeedbackContent) => void;
  update: (id: string, content: FeedbackContent) => void;
  dismiss: (id: string, notifyOnClose?: boolean) => void;
}

const FeedbackToastContext = createContext<FeedbackToastContextValue | null>(null);

const META: Record<FeedbackType, { icon: string; color: string; background: string }> = {
  success: { icon: '✅', color: AppColors.success, background: AppColors.successSoft },
  error: { icon: '⛔', color: AppColors.danger, background: AppColors.dangerSoft },
  info: { icon: 'ℹ️', color: AppColors.warning, background: AppColors.warningSoft },
};

const FEEDBACK_DURATION_MS = 5000;
const ENTER_DURATION_MS = 260;
const EXIT_DURATION_MS = 220;

export function useFeedbackToast(): FeedbackToastContextValue {
  const value = useContext(FeedbackToastContext);
  if (!value) {
    throw new Error('FeedbackBanner harus berada di dalam FeedbackToastProvider.');
  }
  return value;
}

export function FeedbackToastProvider({ children }: PropsWithChildren) {
  const [activeFeedback, setActiveFeedback] = useState<ActiveFeedback | null>(null);
  const activeFeedbackRef = useRef(activeFeedback);
  useEffect(() => {
    activeFeedbackRef.current = activeFeedback;
  }, [activeFeedback]);

  const present = useCallback((id: string, content: FeedbackContent) => {
    setActiveFeedback({ ...content, id, revision: 0, phase: 'visible', notifyOnClose: false });
  }, []);

  const update = useCallback((id: string, content: FeedbackContent) => {
    setActiveFeedback((current) => {
      if (!current || current.id !== id) return current;
      return {
        ...current,
        ...content,
        revision: current.revision + 1,
        phase: 'visible',
        notifyOnClose: false,
      };
    });
  }, []);

  const dismiss = useCallback((id: string, notifyOnClose = true) => {
    setActiveFeedback((current) => {
      if (!current || current.id !== id || current.phase === 'closing') return current;
      return { ...current, phase: 'closing', notifyOnClose };
    });
  }, []);

  const finishDismiss = useCallback((id: string) => {
    const current = activeFeedbackRef.current;
    if (!current || current.id !== id || current.phase !== 'closing') return;
    setActiveFeedback(null);
    if (current.notifyOnClose) current.onClose?.();
  }, []);

  const value = useMemo(
    () => ({ present, update, dismiss }),
    [dismiss, present, update],
  );

  return (
    <FeedbackToastContext.Provider value={value}>
      <View style={styles.providerRoot}>
        {children}
        <FeedbackToastHost feedback={activeFeedback} dismiss={dismiss} finishDismiss={finishDismiss} />
      </View>
    </FeedbackToastContext.Provider>
  );
}

interface FeedbackToastHostProps {
  feedback: ActiveFeedback | null;
  dismiss: (id: string, notifyOnClose?: boolean) => void;
  finishDismiss: (id: string) => void;
}

function FeedbackToastHost({ feedback, dismiss, finishDismiss }: FeedbackToastHostProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-180);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!feedback) {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
      cancelAnimation(progress);
      return;
    }

    if (feedback.phase === 'closing') {
      cancelAnimation(progress);
      translateY.value = withTiming(
        -180,
        { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishDismiss)(feedback.id);
        },
      );
      opacity.value = withTiming(0, { duration: EXIT_DURATION_MS });
      return;
    }

    cancelAnimation(translateY);
    cancelAnimation(opacity);
    cancelAnimation(progress);
    translateY.value = -180;
    opacity.value = 0;
    progress.value = 1;

    translateY.value = withTiming(0, {
      duration: ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: ENTER_DURATION_MS });
    progress.value = withDelay(
      ENTER_DURATION_MS,
      withTiming(
        0,
        { duration: FEEDBACK_DURATION_MS, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(dismiss)(feedback.id, true);
        },
      ),
    );
  }, [dismiss, feedback, finishDismiss, opacity, progress, translateY]);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!feedback) return null;

  const meta = META[feedback.type];
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        pointerEvents="box-none"
        style={[styles.positioner, { top: insets.top + Spacing.two }, toastStyle]}>
        <View
          testID={feedback.testID}
          accessibilityRole="alert"
          style={[styles.banner, { backgroundColor: meta.background, borderColor: meta.color }]}>
          <Text style={styles.icon}>{meta.icon}</Text>
          <View style={styles.content}>
            <Text style={[styles.title, { color: meta.color }]}>{feedback.title}</Text>
            <Text style={styles.message}>{feedback.message}</Text>
          </View>
          <Pressable
            onPress={() => dismiss(feedback.id, true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Tutup pesan">
            <Text style={[styles.close, { color: meta.color }]}>×</Text>
          </Pressable>
          <View pointerEvents="none" style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { backgroundColor: meta.color }, progressStyle]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  providerRoot: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10000,
    elevation: 10000,
  },
  positioner: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  banner: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 4,
    padding: Spacing.three,
    paddingBottom: Spacing.three + 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  icon: { fontSize: 18 },
  content: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 19, color: AppColors.text },
  close: { fontSize: 18, lineHeight: 20, fontWeight: '700' },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  progressFill: { height: '100%', alignSelf: 'flex-start' },
});
