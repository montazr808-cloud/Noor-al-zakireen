import { useThemeContext } from '@/contexts/theme-contexts';

export function useTheme() {
  const { colors } = useThemeContext();
  return colors;
}