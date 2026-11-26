const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopPc', {
  isDesktopPc: true,
  appName: 'gestion antiquite PC',
  platform: process.platform,
});
