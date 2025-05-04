/* eslint-disable dot-notation */
import { Doris } from '@app/doris/doris';
import { KeepTrackApiEvents } from '@app/interfaces';
import { ScreenRecorder } from '@app/plugins/screen-recorder/screen-recorder';
import { setupDefaultHtml } from './environment/standard-env';
import { standardPluginSuite, websiteInit } from './generic-tests';

describe('ScreenRecorder_class', () => {
  let screenRecorderPlugin: ScreenRecorder;

  beforeEach(() => {
    setupDefaultHtml();
    screenRecorderPlugin = new ScreenRecorder();
  });

  standardPluginSuite(ScreenRecorder, 'ScreenRecorder');
  // standardPluginMenuButtonTests(ScreenRecorder, 'ScreenRecorder');

  // Tests stopping a video
  test('ScreenRecorder_stop_video', () => {
    websiteInit(screenRecorderPlugin);

    screenRecorderPlugin['streamManagerInstance_'].isVideoRecording = true;
    screenRecorderPlugin['streamManagerInstance_']['mediaRecorder_'] = {
      stop: () => {
        // Do nothing
      },
    } as unknown as MediaRecorder;
    screenRecorderPlugin['streamManagerInstance_']['stream_'] = {
      getTracks: () => [],
    } as unknown as MediaStream;
    screenRecorderPlugin['streamManagerInstance_'].save = () => {
      // Do nothing
    };

    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.bottomMenuClick, screenRecorderPlugin.bottomIconElementName)).not.toThrow();
  });

  // Tests error handling
  test('ScreenRecorder_error_checking', () => {
    websiteInit(screenRecorderPlugin);

    screenRecorderPlugin['streamManagerInstance_'].start = () => {
      throw new Error('test');
    };

    expect(() => Doris.getInstance().emit(KeepTrackApiEvents.bottomMenuClick, screenRecorderPlugin.bottomIconElementName)).not.toThrow();
  });
});
