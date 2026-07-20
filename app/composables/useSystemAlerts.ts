let nativeChannelReady = false

async function isNative() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export async function requestSystemAlerts() {
  if (await isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const permissions = await LocalNotifications.requestPermissions()
    if (permissions.display === 'granted' && !nativeChannelReady) {
      await LocalNotifications.createChannel({
        id: 'love-home-alerts',
        name: 'Love小家通知',
        description: '悄悄话和来电提醒',
        importance: 5,
        sound: 'default',
        vibration: true,
      }).catch(() => undefined)
      nativeChannelReady = true
    }
    return permissions.display === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'default') await Notification.requestPermission()
  return Notification.permission === 'granted'
}

export async function notifySystem(title: string, body: string, id = 1001) {
  if (await isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (!nativeChannelReady && !(await requestSystemAlerts())) return false
    await LocalNotifications.schedule({ notifications: [{ id, title, body, channelId: 'love-home-alerts', sound: 'default' }] })
    return true
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const notification = new Notification(title, { body, tag: `love-home-${id}`, icon: '/favicon.ico', renotify: true })
  notification.onclick = () => { window.focus(); notification.close() }
  return true
}
