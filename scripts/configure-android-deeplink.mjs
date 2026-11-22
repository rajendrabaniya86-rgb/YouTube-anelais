import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

const manifestPath = 'android/app/src/main/AndroidManifest.xml';
const scheme = 'com.rajendra.globaltrustnetwork';
const host = 'login-callback';
let manifest = await readFile(manifestPath, 'utf8');

if (manifest.includes('android:host="login-callback"') && manifest.includes('android:scheme="com.rajendra.globaltrustnetwork"')) {
  console.log('Google OAuth deep link already configured.');
} else {
  const activityClose = manifest.indexOf('</activity>');
  if (activityClose < 0) throw new Error('Could not find the Capacitor MainActivity in AndroidManifest.xml.');
  const intentFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${scheme}" android:host="${host}" />
            </intent-filter>
`;
  manifest = manifest.slice(0, activityClose) + intentFilter + manifest.slice(activityClose);
  await writeFile(manifestPath, manifest);
  console.log('Configured Google OAuth deep link: ' + scheme + '://' + host);
}
