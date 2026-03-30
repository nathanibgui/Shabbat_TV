import { useColorScheme } from 'react-native';
import { colors, type ThemeColors } from '../theme/colors';
import { useStore } from './useStore';

export function useTheme(): { theme: ThemeColors; isDark: boolean } {
  const systemScheme = useColorScheme();
  const { colorScheme } = useStore();

  const isDark =
    colorScheme === 'system'
      ? systemScheme === 'dark'
      : colorScheme === 'dark';

  return {
    theme: isDark ? colors.dark : colors.light,
    isDark,
  };
}
