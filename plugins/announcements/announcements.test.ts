import { describe, expect, test } from 'bun:test';
import { ForbiddenError, testPlugin, textsOf } from '@app/plugin-sdk/testing';
import announcements from './index';

const city = { id: 'city', name: 'Urząd', role: 'admin' } as const;
const anna = { id: 'anna', name: 'Anna', role: 'user' } as const;

const at = (day: number) => new Date(Date.UTC(2026, 9, day, 12));

describe('announcements', () => {
  test('only admins publish and remove; residents see no form', async () => {
    const t = await testPlugin(announcements, { user: anna });
    await expect(
      t.tool('publish', { title: 'Zamknięcie ulicy' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(textsOf(await t.view('list'))).not.toContain('Tytuł');
    expect(textsOf(await t.as(city).view('list'))).toContain('Tytuł');

    const { data } = await t
      .as(city)
      .tool('publish', { title: 'Zamknięcie ulicy', body: 'W sobotę.' });
    const id = (data as { id: string }).id;
    expect(textsOf(await t.view('item', { id }))).toEqual([
      'Zamknięcie ulicy',
      'W sobotę.',
      'Wszystkie ogłoszenia',
    ]);
    await expect(t.tool('remove', { id })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect((await t.as(city).tool('remove', { id })).toast).toBe(
      'Ogłoszenie usunięte.',
    );
    expect((await t.as(city).tool('remove', { id })).error).toBe(
      'To ogłoszenie nie istnieje.',
    );
  });

  test('dashboard widget: hidden without announcements, then shows what is new since the last visit', async () => {
    const t = await testPlugin(announcements, { user: anna });
    expect(await t.dashboardWidget('latest')).toBeNull();

    t.setNow(at(1));
    await t.as(city).tool('publish', { title: 'Zebranie użytkowników' });
    expect(textsOf((await t.dashboardWidget('latest'))!)).toEqual([
      'Ogłoszenia',
      '1 nowe ogłoszenie od Twojej ostatniej wizyty',
      'Zebranie użytkowników',
      'Wszystkie ogłoszenia',
    ]);

    t.setNow(at(2));
    await t.view('list');
    expect(textsOf((await t.dashboardWidget('latest'))!)).toEqual([
      'Ogłoszenia',
      'Nic nowego od Twojej ostatniej wizyty.',
      'Wszystkie ogłoszenia',
    ]);

    for (const [day, title] of [
      [3, 'Remont'],
      [4, 'Odbiór odpadów'],
      [5, 'Festyn'],
      [6, 'Przerwa w dostawie wody'],
      [7, 'Koncert'],
    ] as const) {
      t.setNow(at(day));
      await t.as(city).tool('publish', { title });
    }
    const texts = textsOf((await t.dashboardWidget('latest'))!);
    expect(texts).toContain('5 nowych ogłoszeń od Twojej ostatniej wizyty');
    expect(texts).toEqual(
      expect.arrayContaining(['Koncert', 'Przerwa w dostawie wody']),
    );
    expect(texts).not.toContain('Festyn');
  });
});
