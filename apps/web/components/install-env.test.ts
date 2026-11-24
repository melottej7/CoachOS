import { describe, expect, it } from 'vitest';
import { installEnv } from './install-env';

// D-171 : le bon guide d’installation pour chaque appareil.
const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.33.108]',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  androidWebview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

describe('installEnv (D-171)', () => {
  it('reconnaît iPhone avec Safari, avec un autre navigateur, et l’iPad qui se présente comme un Mac', () => {
    expect(installEnv(UA.iphoneSafari, false)).toBe('ios-safari');
    expect(installEnv(UA.iphoneChrome, false)).toBe('ios-other');
    expect(installEnv(UA.ipadAsMac, false, 5)).toBe('ios-safari');
    expect(installEnv(UA.ipadAsMac, false, 0)).toBe('desktop');
  });
  it('repère les navigateurs intégrés aux applications (Instagram, Facebook, vue web Android)', () => {
    expect(installEnv(UA.iphoneInstagram, false)).toBe('in-app');
    expect(installEnv(UA.iphoneFacebook, false)).toBe('in-app');
    expect(installEnv(UA.androidWebview, false)).toBe('in-app');
  });
  it('distingue Chrome et Samsung Internet sur Android, et l’ordinateur', () => {
    expect(installEnv(UA.androidChrome, false)).toBe('android');
    expect(installEnv(UA.androidSamsung, false)).toBe('android-samsung');
    expect(installEnv(UA.macChrome, false)).toBe('desktop');
    expect(installEnv(UA.windows, false)).toBe('desktop');
  });
  it('déjà installée : rien à montrer, quel que soit l’appareil', () => {
    expect(installEnv(UA.iphoneSafari, true)).toBe('installed');
    expect(installEnv(UA.androidChrome, true)).toBe('installed');
  });
});
