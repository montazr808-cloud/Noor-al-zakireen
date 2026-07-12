import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { Colors, type ThemeName } from '@/constants/theme';
import { BackgroundId } from '@/utils/backgroundSettings';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontSizeOption = 'small' | 'normal' | 'large';

const FONT_SCALES: Record<FontSizeOption, number> = {
  small: 0.85,
  normal: 1,
  large: 1.15,
};

const THEME_MODE_KEY = 'noor_theme_mode';
const FONT_SIZE_KEY = 'noor_font_size';
const BG_STORAGE_KEY = '@app_settings_background';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ThemeName;
  colors: typeof Colors.light;
  fontSize: FontSizeOption;
  fontScale: number;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setFontSize: (size: FontSizeOption) => void;
  backgroundId: BackgroundId;
  setBackgroundId: (id: BackgroundId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [fontSize, setFontSizeState] = useState<FontSizeOption>('normal');
  const [backgroundId, setBackgroundIdState] = useState<BackgroundId>('quran');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all([
          AsyncStorage.getItem(THEME_MODE_KEY),
          AsyncStorage.getItem(FONT_SIZE_KEY),
          AsyncStorage.getItem(BG_STORAGE_KEY),
        ]);
        const savedMode = results[0];
        const savedFontSize = results[1];
        const savedBg = results[2];

        const validModes = ['light', 'dark', 'auto'];
        const validSizes = ['small', 'normal', 'large'];

        if (savedMode !== null && validModes.indexOf(savedMode) !== -1) {
          setModeState(savedMode as ThemeMode);
        }
        if (savedFontSize !== null && validSizes.indexOf(savedFontSize) !== -1) {
          setFontSizeState(savedFontSize as FontSizeOption);
        }
        if (savedBg !== null) {
          setBackgroundIdState(savedBg as BackgroundId);
        }
      } catch (error) {
        console.warn('فشل تحميل الإعدادات:', error);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_MODE_KEY, newMode).catch((e) => {
      console.warn('فشل حفظ وضع الثيم:', e);
    });
  };

  const setFontSize = (newSize: FontSizeOption) => {
    setFontSizeState(newSize);
    AsyncStorage.setItem(FONT_SIZE_KEY, newSize).catch((e) => {
      console.warn('فشل حفظ حجم الخط:', e);
    });
  };

  const setBackgroundId = (id: BackgroundId) => {
    setBackgroundIdState(id);
    AsyncStorage.setItem(BG_STORAGE_KEY, id).catch((e) => {
      console.warn('فشل حفظ الخلفية:', e);
    });
  };

  const resolvedTheme: ThemeName = useMemo(function () {
    if (mode === 'auto') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return mode;
  }, [mode, systemScheme]);

  const value = useMemo<ThemeContextValue>(
    function () {
      return {
        mode,
        resolvedTheme,
        colors: Colors[resolvedTheme],
        fontSize,
        fontScale: FONT_SCALES[fontSize],
        isDark: resolvedTheme === 'dark',
        setMode,
        setFontSize,
        backgroundId,
        setBackgroundId,
      };
    },
    [mode, resolvedTheme, fontSize, backgroundId]
  );

  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext لازم يستخدم داخل ThemeProvider');
  }
  return context;
}
