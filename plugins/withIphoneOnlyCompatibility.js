const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins')

/**
 * App Store の Compatibility から iPod touch と Mac（Designed for iPhone）を外す。
 * - gps: iPod touch に無いハードウェア。位置情報アプリとして正当。
 * - SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD=NO: Apple Silicon Mac 向け配布をバイナリ側で拒否。
 */
function withIphoneOnlyCompatibility(config) {
  config = withInfoPlist(config, (mod) => {
    const existing = mod.modResults.UIRequiredDeviceCapabilities
    const caps = new Set(
      Array.isArray(existing) ? existing : existing ? [existing] : []
    )
    caps.add('arm64')
    caps.add('gps')
    mod.modResults.UIRequiredDeviceCapabilities = [...caps]
    mod.modResults.LSRequiresIPhoneOS = true
    mod.modResults.UIDeviceFamily = [1]
    return mod
  })

  config = withXcodeProject(config, (mod) => {
    const configurations = mod.modResults.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings
      if (!buildSettings) continue
      buildSettings.TARGETED_DEVICE_FAMILY = '"1"'
      buildSettings.SUPPORTS_MACCATALYST = 'NO'
      buildSettings.SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = 'NO'
      buildSettings.SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = 'NO'
    }
    return mod
  })

  return config
}

module.exports = withIphoneOnlyCompatibility
