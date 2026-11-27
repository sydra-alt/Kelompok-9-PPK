import { useCallback, useEffect, useId, useRef } from 'react';

import { useFeedbackToast } from '@/components/FeedbackToastProvider';

export type FeedbackType = 'success' | 'error' | 'info';

interface FeedbackBannerProps {
  type: FeedbackType;
  title: string;
  message: string;
  onClose?: () => void;
  testID?: string;
}

/** Registers a status message in the fixed app-level feedback overlay. */
export function FeedbackBanner({ type, title, message, onClose, testID }: FeedbackBannerProps) {
  const id = useId();
  const onCloseRef = useRef(onClose);

  const { present, update, dismiss } = useFeedbackToast();
  const handleClose = useCallback(() => onCloseRef.current?.(), []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    present(id, { type, title, message, testID, onClose: handleClose });
    return () => dismiss(id, false);
    // A status message is registered once; content changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismiss, handleClose, id, present]);

  useEffect(() => {
    update(id, { type, title, message, testID, onClose: handleClose });
  }, [handleClose, id, message, testID, title, type, update]);

  return null;
}
