import { describe, expect, it } from 'vitest';
import { AppError } from '@core/errors/domain/AppError';
import { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import type { AppErrorName } from '@core/errors/domain/AppErrorName';

/**
 * What the channel promises whoever publishes into it: a notice
 * reaches a reader even when it was raised before any surface could
 * show it, and one kind of failure never silences another. The two
 * errors below stand in for any pair — the channel reads nothing but
 * their names.
 */

class FakeNotice extends AppError {
  readonly name: AppErrorName;

  constructor(name: AppErrorName, message: string) {
    super(message);
    this.name = name;
  }
}

describe('AppNoticeChannel', () => {
  const videoNotKept = (message = 'video') => new FakeNotice('ProjectVideoStoreFailedError', message);
  const proxyFallback = () => new FakeNotice('PreviewProxyGenerationFailedError', 'proxy');

  const collectFrom = (channel: AppNoticeChannel) => {
    const received: AppError[] = [];
    channel.subscribe((error) => { received.push(error); });
    return received;
  };

  it('hands a notice raised before anyone listened to the first listener', () => {
    const channel = new AppNoticeChannel();
    channel.publish(videoNotKept());

    expect(collectFrom(channel).map((error) => error.name)).toEqual(['ProjectVideoStoreFailedError']);
  });

  it('keeps every kind of failure raised while nobody listened', () => {
    const channel = new AppNoticeChannel();
    channel.publish(videoNotKept());
    channel.publish(proxyFallback());

    expect(collectFrom(channel).map((error) => error.name)).toEqual([
      'ProjectVideoStoreFailedError',
      'PreviewProxyGenerationFailedError',
    ]);
  });

  it('holds the newest of a failure that repeated while nobody listened', () => {
    const channel = new AppNoticeChannel();
    channel.publish(videoNotKept('first'));
    channel.publish(videoNotKept('second'));

    expect(collectFrom(channel).map((error) => error.message)).toEqual(['second']);
  });

  it('hands a held notice to one listener only', () => {
    const channel = new AppNoticeChannel();
    channel.publish(videoNotKept());
    const first = collectFrom(channel);

    const second = collectFrom(channel);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('broadcasts to everyone listening at the time', () => {
    const channel = new AppNoticeChannel();
    const first = collectFrom(channel);
    const second = collectFrom(channel);

    channel.publish(proxyFallback());

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });
});
