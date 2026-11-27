import type { PropsWithChildren, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, type ModalProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type MotionVariant = 'popup' | 'sheet';

const ModalProgressContext = createContext<SharedValue<number> | null>(null);

interface AnimatedModalProps extends PropsWithChildren {
  visible: boolean;
  variant: MotionVariant;
  onRequestClose: NonNullable<ModalProps['onRequestClose']>;
  onShow?: () => void;
  statusBarTranslucent?: boolean;
}

/** A transparent native modal whose backdrop and content animate in both directions. */
export function AnimatedModal({
  visible,
  variant,
  onRequestClose,
  onShow,
  statusBarTranslucent = true,
  children,
}: AnimatedModalProps) {
  const [mounted, setMounted] = useState(visible);
  const [retainedChildren, setRetainedChildren] = useState<ReactNode>(visible ? children : null);
  const progress = useSharedValue(0);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (visible && children !== retainedChildren) setRetainedChildren(children);

  useEffect(() => {
    if (visible) {
      progress.set(
        withTiming(1, {
          duration: variant === 'popup' ? 260 : 300,
          easing: Easing.out(Easing.cubic),
        }),
      );
      return;
    }

    if (!mounted) return;

    progress.set(
      withTiming(
        0,
        {
          duration: variant === 'popup' ? 190 : 260,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      ),
    );
  }, [visible, mounted, variant, progress]);

  const contextValue = useMemo(() => progress, [progress]);

  return (
    <Modal
      visible={visible || mounted}
      transparent
      animationType="none"
      onShow={() => {
        setMounted(true);
        onShow?.();
      }}
      onRequestClose={onRequestClose}
      statusBarTranslucent={statusBarTranslucent}>
      <Animated.View style={[styles.root, backdropStyle]}>
        {mounted ? (
          <ModalProgressContext.Provider value={contextValue}>
            {visible ? children : retainedChildren}
          </ModalProgressContext.Provider>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

interface ModalMotionProps extends PropsWithChildren {
  variant: MotionVariant;
  style?: StyleProp<ViewStyle>;
}

/** Scales a popup in/out or moves a bottom sheet up/down with its parent modal. */
export function ModalMotion({ variant, style, children }: ModalMotionProps) {
  const progress = useContext(ModalProgressContext);
  const { height } = useWindowDimensions();
  const contentStyle = useAnimatedStyle(() => {
    const value = progress?.value ?? 1;
    return variant === 'popup'
      ? { transform: [{ scale: interpolate(value, [0, 1], [0.82, 1]) }] }
      : { transform: [{ translateY: (1 - value) * height }] };
  }, [height, variant]);

  return (
    <Animated.View style={[contentStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
