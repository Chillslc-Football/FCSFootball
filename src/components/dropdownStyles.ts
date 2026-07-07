import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '@/theme';

const BODY_LINE_HEIGHT =
  typeof typography.body.lineHeight === 'number' ? typography.body.lineHeight : 24;

/** Fixed row height for FlatList scroll positioning — matches optionRow padding + label. */
export const DROPDOWN_OPTION_ROW_HEIGHT =
  spacing.md * 2 + BODY_LINE_HEIGHT + StyleSheet.hairlineWidth;

/** Fixed row height for section headers in filter dropdowns. */
export const DROPDOWN_SECTION_HEADER_HEIGHT = spacing.md + spacing.xs + 16;

/** Shared trigger + sheet option styles for Scores dropdowns. */
export const dropdownStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    minWidth: 0,
    width: '100%',
  },
  triggerPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  triggerLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(201, 162, 39, 0.08)',
  },
  optionRowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  optionLabelSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  sectionHeaderText: {
    ...typography.label,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});

export const DROPDOWN_CHEVRON_SIZE = 18;
