/**
 * @react-native-async-storage/async-storage v3.0.x は Android アーティファクト
 * (org.asyncstorage.shared_storage:storage-android) を Maven Central で公開しておらず、
 * パッケージ内の `android/local_repo` から解決する必要がある（v3.1.0 以降は不要）。
 * 公式 README の手順どおり、生成される android/build.gradle の allprojects に
 * local_repo を追加する。Android プロジェクト生成時のみ動作し、iOS には一切影響しない。
 */
const { withProjectBuildGradle } = require('expo/config-plugins')

const MARKER = 'async-storage/android/local_repo'

const SNIPPET = `
// @react-native-async-storage/async-storage v3.0.x: local_repo から storage-android を解決（v3.1+ に上げたら削除可）
allprojects {
  repositories {
    maven { url = uri("\${rootDir}/../node_modules/@react-native-async-storage/async-storage/android/local_repo") }
  }
}
`

module.exports = function withAsyncStorageLocalRepo(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET
    }
    return cfg
  })
}
