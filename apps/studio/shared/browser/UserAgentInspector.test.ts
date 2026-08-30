import { describe, expect, it } from 'vitest';
import { UserAgentInspector } from './UserAgentInspector';

const IPHONE_IOS_18_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_IOS_26_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const PIXEL_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87';
const LINUX_FIREFOX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';

describe('UserAgentInspector version parsing', () => {
  it('reads the iOS release and the Safari version from an iPhone user agent', () => {
    const inspector = new UserAgentInspector(IPHONE_IOS_18_SAFARI);
    expect(inspector.getOsVersion()).toBe('18.5');
    expect(inspector.getBrowserVersion()).toBe('18.5');
  });

  it('tells a WebCodecs-audio-capable Safari apart from an older one by version', () => {
    expect(new UserAgentInspector(IPHONE_IOS_26_SAFARI).getBrowserVersion()).toBe('26.0');
    expect(new UserAgentInspector(IPHONE_IOS_18_SAFARI).getBrowserVersion()).toBe('18.5');
  });

  it('reads the Android release and the Chrome version from a phone user agent', () => {
    const inspector = new UserAgentInspector(PIXEL_CHROME);
    expect(inspector.getOsVersion()).toBe('14');
    expect(inspector.getBrowserVersion()).toBe('126.0.6478.71');
  });

  it('reads the frozen macOS token and the Safari version from a desktop user agent', () => {
    const inspector = new UserAgentInspector(MAC_SAFARI);
    expect(inspector.getOsVersion()).toBe('10.15.7');
    expect(inspector.getBrowserVersion()).toBe('17.4');
  });

  it('reads the Edge version rather than the Chrome token it also carries', () => {
    const inspector = new UserAgentInspector(WINDOWS_EDGE);
    expect(inspector.getOsVersion()).toBe('10.0');
    expect(inspector.getBrowserVersion()).toBe('126.0.2592.87');
  });

  it('reports no OS version when the user agent carries none', () => {
    const inspector = new UserAgentInspector(LINUX_FIREFOX);
    expect(inspector.getOsVersion()).toBeNull();
    expect(inspector.getBrowserVersion()).toBe('127.0');
  });
});
