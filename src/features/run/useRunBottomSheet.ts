import {useCallback, useMemo, useRef, useState} from 'react';
import {Animated, PanResponder} from 'react-native';

const SHEET_EXPANDED_OFFSET = 0;
const SHEET_COLLAPSED_VISIBLE_HEIGHT = 188;

export type SheetSnap = 'expanded' | 'middle' | 'collapsed';

export function useRunBottomSheet(runStageHeight: number) {
  const sheetOffset = useRef(new Animated.Value(520)).current;
  const sheetOffsetPosition = useRef(520);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('collapsed');

  const sheetHeight = Math.max(560, runStageHeight - 34);
  const sheetCollapsedOffset = Math.max(0, sheetHeight - SHEET_COLLAPSED_VISIBLE_HEIGHT);
  const sheetMiddleOffset = Math.round(sheetCollapsedOffset * 0.52);
  const sheetCurrentOffset =
    sheetSnap === 'expanded'
      ? SHEET_EXPANDED_OFFSET
      : sheetSnap === 'middle'
        ? sheetMiddleOffset
        : sheetCollapsedOffset;
  const sheetScrollBottomInset = Math.max(40, sheetCurrentOffset + 56);
  const sheetSnapPoints = useMemo(
    () => [SHEET_EXPANDED_OFFSET, sheetMiddleOffset, sheetCollapsedOffset],
    [sheetCollapsedOffset, sheetMiddleOffset],
  );

  const nearestSheetSnap = useCallback(
    (value: number) =>
      sheetSnapPoints.reduce((nearest, point) =>
        Math.abs(point - value) < Math.abs(nearest - value) ? point : nearest,
      ),
    [sheetSnapPoints],
  );

  const syncSheetOffset = useCallback(() => {
    const target =
      sheetSnap === 'expanded'
        ? SHEET_EXPANDED_OFFSET
        : sheetSnap === 'middle'
          ? sheetMiddleOffset
          : sheetCollapsedOffset;
    sheetOffsetPosition.current = target;
    sheetOffset.setValue(target);
  }, [sheetCollapsedOffset, sheetMiddleOffset, sheetOffset, sheetSnap]);

  const animateSheetTo = useCallback(
    (toValue: number) => {
      sheetOffsetPosition.current = toValue;
      setSheetSnap(
        toValue === SHEET_EXPANDED_OFFSET
          ? 'expanded'
          : toValue === sheetCollapsedOffset
            ? 'collapsed'
            : 'middle',
      );
      Animated.spring(sheetOffset, {
        toValue,
        useNativeDriver: true,
        tension: 90,
        friction: 14,
      }).start();
    },
    [sheetCollapsedOffset, sheetOffset],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          sheetOffset.stopAnimation(value => {
            sheetOffsetPosition.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, sheetOffsetPosition.current + gesture.dy),
          );
          sheetOffset.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const next = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, sheetOffsetPosition.current + gesture.dy),
          );
          const projected = Math.max(
            SHEET_EXPANDED_OFFSET,
            Math.min(sheetCollapsedOffset, next + gesture.vy * 120),
          );
          animateSheetTo(nearestSheetSnap(projected));
        },
        onPanResponderTerminate: () => {
          sheetOffset.stopAnimation(value => {
            animateSheetTo(nearestSheetSnap(value));
          });
        },
      }),
    [animateSheetTo, nearestSheetSnap, sheetCollapsedOffset, sheetOffset],
  );

  return {
    setSheetSnap,
    sheetHeight,
    sheetOffset,
    sheetPanResponder,
    sheetScrollBottomInset,
    syncSheetOffset,
  };
}
