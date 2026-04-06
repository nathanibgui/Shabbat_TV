import { useColorScheme } from 'react-native';
import { colors, type ThemeColors } from '../theme/colors';

export function useTheme(): { theme: ThemeColors; isDark: boolean } {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';

  return {
    theme: isDark ? colors.dark : colors.light,
    isDark,
  };
}
