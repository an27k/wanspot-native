// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*', 'supabase/functions/*', 'integrations/*'],
  },
  {
    rules: {
      // React Compiler 前提の strict ルール群。
      // RN Animated の `useRef(new Animated.Value()).current` や
      // Reanimated の `sharedValue.value = x` という公式イディオムと衝突するため無効化。
      // React Compiler を導入する際に再有効化を検討する。
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
