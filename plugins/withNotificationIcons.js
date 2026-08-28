// ===== plugins/withNotificationIcons.js =====
// Config plugin بسيط: ينسخ أيقونتي الإشعار (الصغيرة البيضاء + الكبيرة الملونة)
// من src/assets/ إلى android/app/src/main/res/drawable/ تلقائياً بكل مرة
// تسوي "npx expo prebuild"، لأن مجلد android/ ينمسح ويتولد من جديد كل مرة
// وبيه تنمسح أي ملفات كنت تحطها هناك يدوياً.
//
// طريقة الاستخدام: تأكد الملفين هذولة موجودين فعلاً بمشروعك على هذا المسار
// بالضبط قبل ما تسوي prebuild:
//   src/assets/ic_notification.png
//   src/assets/ic_notification_large.png

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function copyIconFile(projectRoot, sourceRelPath, destRelPath) {
  const source = path.join(projectRoot, sourceRelPath);
  const dest = path.join(projectRoot, destRelPath);

  if (!fs.existsSync(source)) {
    console.warn(
      `[withNotificationIcons] تحذير: ما لقيت الملف "${sourceRelPath}" - تأكد إنه موجود بهذا المسار بالضبط.`
    );
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  console.log(`[withNotificationIcons] نسخ ${sourceRelPath} -> ${destRelPath}`);
}

module.exports = function withNotificationIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      copyIconFile(
        projectRoot,
        'src/assets/ic_notification.png',
        'android/app/src/main/res/drawable/ic_notification.png'
      );

      copyIconFile(
        projectRoot,
        'src/assets/ic_notification_large.png',
        'android/app/src/main/res/drawable/ic_notification_large.png'
      );

      return config;
    },
  ]);
};