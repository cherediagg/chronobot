import { BotActivityLog } from './bot-activity-log';

describe('BotActivityLog', () => {
  it('keeps only the latest 500 log entries', () => {
    const activity = new BotActivityLog();
    for (let index = 0; index < 501; index += 1) {
      activity.addLog('INFO', `entry-${index}`);
    }

    expect(activity.getLogs(500)).toHaveLength(500);
    expect(activity.getLogs(1)[0].message).toBe('entry-500');
  });

  it('clears logs without removing events', () => {
    const activity = new BotActivityLog();
    activity.addLog('INFO', 'entry');
    activity.addEvent({
      id: 'event-1',
      type: 'system',
      title: 'System event',
      subtitle: 'Details',
      relativeTime: 'Ahora mismo',
      timestamp: Date.now()
    });

    activity.clearLogs();

    expect(activity.getLogs()).toEqual([]);
    expect(activity.getEvents()).toHaveLength(1);
  });
});
