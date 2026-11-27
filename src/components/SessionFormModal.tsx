import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { AnimatedModal, ModalMotion } from '@/components/ModalMotion';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { Lab, PracticeClass, PracticeSession } from '@/types';
import { getJakartaNowParts, isSessionStartAllowed } from '@/utils/session-time';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const WHEEL_ITEM_HEIGHT = 56;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateLabel(value: string): string {
  return dateFromKey(value).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function addOneMinute(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const total = hours * 60 + minutes + 1;
  if (total >= 24 * 60) return '';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface SessionFormValues {
  classId: string;
  className: string;
  practicalName: string;
  labId: string;
  labName: string;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  room?: string;
  assistantName?: string;
}

interface SessionFormModalProps {
  visible: boolean;
  classes: PracticeClass[];
  labs: Lab[];
  initialData?: PracticeSession | null;
  defaultAssistantName?: string;
  onClose: () => void;
  onSubmit: (data: SessionFormValues) => Promise<void>;
}

export function SessionFormModal({
  visible,
  classes,
  labs,
  initialData,
  defaultAssistantName,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  return (
    <AnimatedModal
      visible={visible}
      variant="sheet"
      onRequestClose={onClose}
      >
      <View style={styles.backdrop}>
        <SessionFormContent
          key={initialData?.id ?? 'new-session'}
          classes={classes}
          labs={labs}
          initialData={initialData}
          defaultAssistantName={defaultAssistantName}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </View>
    </AnimatedModal>
  );
}

function SessionFormContent({
  classes,
  labs,
  initialData,
  defaultAssistantName,
  onClose,
  onSubmit,
}: {
  classes: PracticeClass[];
  labs: Lab[];
  initialData?: PracticeSession | null;
  defaultAssistantName?: string;
  onClose: () => void;
  onSubmit: (data: SessionFormValues) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const todayDate = getJakartaNowParts().date;
  const isCreating = !initialData;

  const [selectedClassId, setSelectedClassId] = useState(
    initialData?.classId ?? classes[0]?.id ?? '',
  );
  const [preferredLabId, setPreferredLabId] = useState(initialData?.labId ?? labs[0]?.id ?? '');
  const selectedLabId = labs.some((lab) => lab.id === preferredLabId)
    ? preferredLabId
    : labs[0]?.id ?? '';
  const initialLab = labs.find((l) => l.id === selectedLabId);
  const [date, setDate] = useState(initialData?.date ?? todayDate);
  const initialStart = initialData?.startTime ?? getJakartaNowParts().time;
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialData?.endTime ?? addOneMinute(initialStart));
  const [activePicker, setActivePicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [topic, setTopic] = useState(initialData?.topic ?? '');
  const [room, setRoom] = useState(initialData?.room ?? initialLab?.name ?? '');
  const [assistantName, setAssistantName] = useState(
    initialData?.assistantName ?? defaultAssistantName ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelectLab = (nextLab: Lab) => {
    const previousLab = labs.find((l) => l.id === selectedLabId);
    setPreferredLabId(nextLab.id);
    setError(null);
    if (!room.trim() || (previousLab && room.trim() === previousLab.name)) {
      setRoom(nextLab.name);
    }
  };

  const chooseDate = (nextDate: Date) => {
    const nextDateKey = dateKey(nextDate);
    setDate(nextDateKey);
    setError(null);
    setActivePicker(null);
    if (isCreating && nextDateKey === todayDate) {
      const minimumStart = getJakartaNowParts().time;
      if (minimumStart && startTime < minimumStart) {
        setStartTime(minimumStart);
        setEndTime(addOneMinute(minimumStart));
      }
    }
  };

  const chooseTime = (target: 'start' | 'end', value: string) => {
    if (target === 'start') {
      setStartTime(value);
      if (endTime <= value) {
        setEndTime(addOneMinute(value));
      }
    } else {
      setEndTime(value);
    }
    setError(null);
    setActivePicker(null);
  };

  const handleSubmit = async () => {
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    if (!selectedClass && !initialData) {
      setError('Pilih kelas praktikum terlebih dahulu.');
      return;
    }

    const selectedLab = labs.find((lab) => lab.id === selectedLabId);
    if (!selectedLab) {
      setError('Pilih laboratorium pelaksanaan praktikum terlebih dahulu.');
      return;
    }

    const trimmedDate = date.trim();
    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();

    if (!trimmedDate || !DATE_PATTERN.test(trimmedDate)) {
      setError('Tanggal praktikum wajib diisi dengan format YYYY-MM-DD.');
      return;
    }
    if (!trimmedStart || !TIME_PATTERN.test(trimmedStart)) {
      setError('Waktu mulai wajib diisi dengan format HH:mm (mis. 08:00).');
      return;
    }
    if (!trimmedEnd || !TIME_PATTERN.test(trimmedEnd)) {
      setError('Waktu selesai wajib diisi dengan format HH:mm (mis. 10:00).');
      return;
    }
    if (trimmedStart >= trimmedEnd) {
      setError('Waktu mulai harus lebih awal daripada waktu selesai.');
      return;
    }
    if (isCreating && !isSessionStartAllowed(trimmedDate, trimmedStart)) {
      setError('Untuk sesi baru, tanggal dan waktu mulai harus sekarang atau setelahnya.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        classId: selectedClass?.id ?? initialData?.classId ?? '',
        className: selectedClass?.name ?? initialData?.className ?? '',
        practicalName: selectedClass?.practicalName ?? initialData?.practicalName ?? 'Praktikum',
        labId: selectedLab.id,
        labName: selectedLab.name,
        date: trimmedDate,
        startTime: trimmedStart,
        endTime: trimmedEnd,
        topic: topic.trim() || undefined,
        room: room.trim() || selectedLab.name,
        assistantName: assistantName.trim() || defaultAssistantName,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan sesi praktikum.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}>
        <ModalMotion variant="sheet" style={styles.card}>
        <View style={styles.sheetContent} accessibilityViewIsModal>
        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeading}>
          <Text style={styles.title}>
            {initialData ? 'Ubah Sesi Praktikum' : 'Tambah Sesi Praktikum'}
          </Text>
          <Text style={styles.subtitle}>
            {initialData
              ? 'Perbarui jadwal, waktu, atau lokasi pertemuan praktikum.'
              : 'Jadwalkan sesi pertemuan praktikum baru untuk praktikan.'}
          </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup formulir sesi"
            disabled={submitting}
            onPress={onClose}
            style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView
          style={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>

          {!initialData ? (
            <View style={styles.field}>
              <Text style={styles.label}>Pilih Kelas untuk Sesi</Text>
              {classes.length === 0 ? (
                <Text style={styles.noClassesWarning}>
                  Belum ada kelas. Buat kelas terlebih dahulu.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {classes.map((c) => {
                    const selected = c.id === selectedClassId;
                    return (
                      <Pressable
                        key={c.id}
                        testID={`session-class-option-${c.id}`}
                        onPress={() => setSelectedClassId(c.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {c.name} — {c.practicalName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Pilih Laboratorium</Text>
            {labs.length === 0 ? (
              <Text style={styles.noClassesWarning}>
                Belum ada laboratorium. Tambahkan laboratorium di tab Lab terlebih dahulu.
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {labs.map((lab) => {
                  const selected = lab.id === selectedLabId;
                  return (
                    <Pressable
                      key={lab.id}
                      testID={`session-lab-option-${lab.id}`}
                      onPress={() => handleSelectLab(lab)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {lab.name}
                        {lab.building ? ` (${lab.building})` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tanggal Praktikum</Text>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => setActivePicker('date')}
              style={styles.pickerButton}>
              <Text style={styles.pickerButtonText}>{formatDateLabel(date)}</Text>
              <Text style={styles.pickerIcon}>▦</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Mulai</Text>
              <Pressable disabled={submitting} onPress={() => setActivePicker('start')} style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>{startTime || 'Pilih jam'}</Text>
                <Text style={styles.pickerIcon}>◷</Text>
              </Pressable>
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Selesai</Text>
              <Pressable disabled={submitting || !startTime} onPress={() => setActivePicker('end')} style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>{endTime || 'Pilih jam'}</Text>
                <Text style={styles.pickerIcon}>◷</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Topik / Materi</Text>
            <TextInput
              value={topic}
              editable={!submitting}
              onChangeText={setTopic}
              placeholder="Contoh: Layouting Flexbox & Grid"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Keterangan Ruangan (Opsional)</Text>
            <TextInput
              value={room}
              editable={!submitting}
              onChangeText={setRoom}
              placeholder="Contoh: Lab Komputer 2 / Gedung E"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nama Asisten Pengampu</Text>
            <TextInput
              value={assistantName}
              editable={!submitting}
              onChangeText={setAssistantName}
              placeholder="Nama asisten yang bertugas"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

        </ScrollView>
        <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <AppButton
            title={submitting ? 'Menyimpan...' : initialData ? 'Simpan Perubahan' : 'Tambah Sesi'}
            onPress={() => void handleSubmit()}
            disabled={
              submitting ||
              labs.length === 0 ||
              !selectedLabId ||
              (!initialData && classes.length === 0)
            }
            style={styles.submitButton}
          />
        </View>
        {activePicker ? (
          <View style={styles.pickerLayer}>
            <Pressable style={styles.pickerDim} onPress={() => setActivePicker(null)} />
            <Animated.View entering={ZoomIn.duration(180)} exiting={ZoomOut.duration(140)} style={styles.pickerPopup}>
            <View>
              <View style={styles.pickerPopupHeader}>
                <Text style={styles.pickerPopupTitle}>
                  {activePicker === 'date'
                    ? 'Pilih Tanggal'
                    : activePicker === 'start'
                      ? 'Waktu Mulai'
                      : 'Waktu Selesai'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tutup pemilih"
                  onPress={() => setActivePicker(null)}
                  style={styles.popupCloseButton}>
                  <Text style={styles.popupCloseText}>×</Text>
                </Pressable>
              </View>
              {activePicker === 'date' ? (
                <SessionDateCalendar
                  date={date}
                  todayDate={todayDate}
                  isCreating={isCreating}
                  onSelect={chooseDate}
                />
              ) : (
                <TimeWheelPicker
                  key={`${activePicker}-${date}-${startTime}`}
                  value={activePicker === 'start' ? startTime : endTime}
                  target={activePicker}
                  isCreating={isCreating}
                  date={date}
                  todayDate={todayDate}
                  startTime={startTime}
                  onCancel={() => setActivePicker(null)}
                  onConfirm={(value) => chooseTime(activePicker, value)}
                />
              )}
            </View>
            </Animated.View>
          </View>
        ) : null}
      </View>
      </ModalMotion>
    </KeyboardAvoidingView>
  );
}

function SessionDateCalendar({
  date,
  todayDate,
  isCreating,
  onSelect,
}: {
  date: string;
  todayDate: string;
  isCreating: boolean;
  onSelect: (value: Date) => void;
}) {
  const selectedDate = dateFromKey(date);
  const [month, setMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const todayMonth = new Date(Number(todayDate.slice(0, 4)), Number(todayDate.slice(5, 7)) - 1, 1);
  const isBeforeCurrentMonth =
    month.getFullYear() < todayMonth.getFullYear() ||
    (month.getFullYear() === todayMonth.getFullYear() && month.getMonth() <= todayMonth.getMonth());
  const leadingBlanks = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  return (
    <View style={styles.calendarPicker}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bulan sebelumnya"
          disabled={isCreating && isBeforeCurrentMonth}
          onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
          style={[styles.monthButton, isCreating && isBeforeCurrentMonth && styles.calendarDayDisabled]}>
          <Text style={styles.monthButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bulan berikutnya"
          onPress={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
          style={styles.monthButton}>
          <Text style={styles.monthButtonText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.calendarGrid}>
        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
          <Text key={day} style={styles.weekday}>{day}</Text>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <View key={`blank-${index}`} style={styles.calendarDay} />
        ))}
        {Array.from({ length: dayCount }, (_, index) => {
          const dayDate = new Date(month.getFullYear(), month.getMonth(), index + 1, 12);
          const key = dateKey(dayDate);
          const disabled = isCreating && key < todayDate;
          const selected = key === date;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(dayDate)}
              style={[styles.calendarDay, selected && styles.calendarDaySelected, disabled && styles.calendarDayDisabled]}>
              <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected, disabled && styles.calendarDayTextDisabled]}>
                {index + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {isCreating ? <Text style={styles.pickerHint}>Tanggal yang sudah lewat tidak bisa dipilih.</Text> : null}
    </View>
  );
}

function WheelColumn({
  value,
  values,
  isDisabled,
  onChange,
}: {
  value: number;
  values: number[];
  isDisabled: (value: number) => boolean;
  onChange: (value: number) => void;
}) {
  const listRef = useRef<FlatList<number>>(null);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: value * WHEEL_ITEM_HEIGHT, animated: false });
  }, [value]);

  const handleScrollEnd = (offset: number) => {
    const desiredIndex = Math.max(0, Math.min(values.length - 1, Math.round(offset / WHEEL_ITEM_HEIGHT)));
    let selectedIndex = desiredIndex;
    if (isDisabled(values[selectedIndex])) {
      for (let distance = 1; distance < values.length; distance += 1) {
        const before = desiredIndex - distance;
        const after = desiredIndex + distance;
        if (before >= 0 && !isDisabled(values[before])) {
          selectedIndex = before;
          break;
        }
        if (after < values.length && !isDisabled(values[after])) {
          selectedIndex = after;
          break;
        }
      }
    }
    listRef.current?.scrollToOffset({ offset: selectedIndex * WHEEL_ITEM_HEIGHT, animated: selectedIndex !== desiredIndex });
    if (!isDisabled(values[selectedIndex])) onChange(values[selectedIndex]);
  };

  return (
    <View style={styles.wheelColumn}>
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(item) => String(item)}
        style={styles.wheelList}
        contentContainerStyle={styles.wheelListContent}
        initialScrollIndex={value}
        showsVerticalScrollIndicator={false}
        bounces={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: WHEEL_ITEM_HEIGHT, offset: index * WHEEL_ITEM_HEIGHT, index })}
        onMomentumScrollEnd={(event) => handleScrollEnd(event.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(event) => handleScrollEnd(event.nativeEvent.contentOffset.y)}
        renderItem={({ item }) => {
          const disabled = isDisabled(item);
          const selected = item === value;
          return (
            <View style={styles.wheelItem}>
              <Text style={[styles.wheelItemText, selected && styles.wheelItemSelected, disabled && styles.wheelItemDisabled]}>
                {String(item).padStart(2, '0')}
              </Text>
            </View>
          );
        }}
      />
      <View pointerEvents="none" style={styles.wheelSelection} />
    </View>
  );
}

function TimeWheelPicker({
  value,
  target,
  isCreating,
  date,
  todayDate,
  startTime,
  onCancel,
  onConfirm,
}: {
  value: string;
  target: 'start' | 'end';
  isCreating: boolean;
  date: string;
  todayDate: string;
  startTime: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [initialHour, initialMinute] = value.split(':').map(Number);
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const allowed = (candidateHour: number, candidateMinute: number) => {
    const candidate = `${String(candidateHour).padStart(2, '0')}:${String(candidateMinute).padStart(2, '0')}`;
    if (target === 'start') {
      return (!isCreating || date !== todayDate || isSessionStartAllowed(date, candidate)) && candidate !== '23:59';
    }
    return candidate > startTime;
  };
  const canConfirm = allowed(hour, minute);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 60 }, (_, index) => index);

  return (
    <View style={styles.timePickerContent}>
      <Text style={styles.pickerHint}>
        {target === 'end'
          ? 'Waktu sebelum jam mulai dinonaktifkan.'
          : isCreating && date === todayDate
            ? 'Pilih waktu sekarang atau setelahnya.'
            : 'Gulir jam dan menit untuk mengatur waktu.'}
      </Text>
      <View style={styles.wheelLabels}>
        <Text style={styles.wheelLabel}>Jam</Text>
        <View style={styles.wheelSeparatorSpacer} />
        <Text style={styles.wheelLabel}>Menit</Text>
      </View>
      <View style={styles.wheelRow}>
        <WheelColumn
          value={hour}
          values={hours}
          isDisabled={(candidateHour) => !minutes.some((candidateMinute) => allowed(candidateHour, candidateMinute))}
          onChange={setHour}
        />
        <Text style={styles.wheelSeparator}>:</Text>
        <WheelColumn
          value={minute}
          values={minutes}
          isDisabled={(candidateMinute) => !allowed(hour, candidateMinute)}
          onChange={setMinute}
        />
      </View>
      <View style={styles.pickerActions}>
        <Pressable onPress={onCancel} style={styles.pickerCancel} accessibilityRole="button">
          <Text style={styles.pickerCancelText}>Batal</Text>
        </Pressable>
        <AppButton
          title="Pilih Waktu"
          disabled={!canConfirm}
          onPress={() => onConfirm(time)}
          style={styles.submitButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: AppColors.overlay,
  },
  keyboardView: {
    width: '100%',
    height: '92%',
    maxHeight: '96%',
  },
  card: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
  },
  sheetContent: {
    flex: 1,
    width: '100%',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: AppColors.surface,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  sheetHeading: { flex: 1, gap: Spacing.one },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.background,
  },
  closeButtonText: { color: AppColors.textMuted, fontSize: 30, lineHeight: 34, fontWeight: '400' },
  formScroll: { flex: 1 },
  sheetFooter: {
    paddingTop: Spacing.three,
    paddingBottom: Platform.OS === 'ios' ? Spacing.five : Spacing.three,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  scroll: {
    gap: Spacing.three,
  },
  title: {
    color: AppColors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: AppColors.textMuted,
    fontSize: 13,
    marginTop: -Spacing.one,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 13,
    backgroundColor: AppColors.dangerSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  noClassesWarning: {
    color: AppColors.warning,
    fontSize: 13,
    fontStyle: 'italic',
  },
  fieldHint: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  pickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    backgroundColor: AppColors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pickerButtonText: { color: AppColors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  pickerIcon: { color: AppColors.primary, fontSize: 18, fontWeight: '800' },
  pickerLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  pickerDim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15, 23, 42, 0.52)' },
  pickerPopup: { width: '100%', maxWidth: 420, padding: Spacing.three, borderRadius: Radius.xl, backgroundColor: AppColors.surface, gap: Spacing.three, elevation: 14 },
  pickerPopupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerPopupTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  popupCloseButton: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.background },
  popupCloseText: { color: AppColors.textMuted, fontSize: 26, lineHeight: 30 },
  calendarPicker: { gap: Spacing.two },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surface },
  monthButtonText: { fontSize: 25, color: AppColors.primary, fontWeight: '700' },
  monthTitle: { color: AppColors.text, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8, fontSize: 11, color: AppColors.textMuted, fontWeight: '700' },
  calendarDay: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calendarDaySelected: { backgroundColor: AppColors.primary },
  calendarDayDisabled: { opacity: 0.35 },
  calendarDayText: { color: AppColors.text, fontSize: 13, fontWeight: '600' },
  calendarDayTextSelected: { color: AppColors.textOnPrimary, fontWeight: '800' },
  calendarDayTextDisabled: { color: AppColors.textMuted },
  pickerHint: { color: AppColors.textMuted, fontSize: 11, lineHeight: 16 },
  pickerPanelTitle: { color: AppColors.text, fontSize: 14, fontWeight: '800' },
  wheelLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  wheelLabel: { width: 92, color: AppColors.textMuted, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  wheelSeparatorSpacer: { width: 12 },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  wheelColumn: { width: 92, height: 168, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: AppColors.background },
  wheelList: { flex: 1 },
  wheelListContent: { paddingVertical: WHEEL_ITEM_HEIGHT },
  wheelItem: { height: WHEEL_ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelItemText: { color: AppColors.textMuted, fontSize: 25, fontWeight: '600' },
  wheelItemSelected: { color: AppColors.text, fontSize: 30, fontWeight: '800' },
  wheelItemDisabled: { opacity: 0.25 },
  wheelSelection: { position: 'absolute', top: WHEEL_ITEM_HEIGHT, right: 0, bottom: WHEEL_ITEM_HEIGHT, left: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: AppColors.border },
  wheelSeparator: { color: AppColors.text, fontSize: 28, fontWeight: '700', marginTop: -2 },
  pickerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  timePickerContent: { gap: Spacing.three },
  pickerCancel: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pickerCancelText: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.text,
  },
  chipTextSelected: {
    color: AppColors.textOnPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
  },
});
