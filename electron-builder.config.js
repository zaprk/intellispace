module.exports = {
    appId: 'com.intellispace.mvp',
    productName: 'IntelliSpace',
    directories: {
      output: 'release'
    },
    files: [
      'dist/**/*',
      'node_modules/**/*',
      'package.json'
    ],
    mac: {
      category: 'public.app-category.productivity',
      icon: 'assets/icon.icns'
    },
    win: {
      target: 'nsis',
      icon: 'assets/icon.ico'
    },
    linux: {
      target: 'AppImage',
      icon: 'assets/icon.png'
    }
  }