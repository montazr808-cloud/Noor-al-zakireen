import { version } from 'expo/package.json';
import { useColorScheme } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { styles } from './styles';

export function WebBadge() {
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
// ...existing code...
      <ThemedText type="code" themeColor="muted" style={styles.versionText}>
        v{version}
      </ThemedText>
// ...existing code...
        source={
          scheme === 'dark'
            ? require('@/assets/images/expo-badge-white.png')
            : require('@/assets/images/expo-badge.png')
        }
        style={styles.badgeImage}
      /{'>'}
    </ThemedView>
  );
}

export default WebBadge;
