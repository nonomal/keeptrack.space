/* eslint-disable @typescript-eslint/no-explicit-any */
import { SettingsManager } from '@app/settings/settings';

declare global {
  module '*.css';
  module '*.jpg';
  module '*.png';
  module '*.svg';
  declare module '*.mp3';
  declare module '*.wav';
  declare module '*.flac';
  declare module '*.m4a';
  declare module '*.txt' {
    const content: string;

    export default content;
  }
  interface Window {
    settingsManager: SettingsManager;
    settingsOverride: any;
    webkitAudioContext: any;
    adsbygoogle: any;
    googletag: typeof googletag;
  }
  interface Global {
    settingsManager: SettingsManager;
    settingsOverride: any;
  }
  let settingsManager: SettingsManager;
}
