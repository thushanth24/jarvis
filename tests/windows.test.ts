import { describe, expect, it, vi } from 'vitest';
import { findChromeExecutable, launchApp, openFolder } from '../src/main/windows';

describe('Windows executable and folder handling', () => {
  it('finds Chrome in standard installation locations', async () => {
    const installed = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const result = await findChromeExecutable({ fileExists: async (candidate) => candidate === installed, registryQuery: async () => null });
    expect(result).toBe(installed);
  });

  it('uses a configured absolute Chrome path as a fallback', async () => {
    const configured = 'D:\\Apps\\Chrome\\chrome.exe';
    const result = await findChromeExecutable({ configuredPath: configured, fileExists: async (candidate) => candidate === configured, registryQuery: async () => null });
    expect(result).toBe(configured);
  });

  it('returns null when Chrome is not installed or configured', async () => {
    const result = await findChromeExecutable({ fileExists: async () => false, registryQuery: async () => null });
    expect(result).toBeNull();
  });

  it('launches Chrome using the discovered absolute executable path', async () => {
    const installed = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const launch = vi.fn(async () => undefined);
    await launchApp('chrome', { fileExists: async (candidate) => candidate === installed, registryQuery: async () => null, launch });
    expect(launch).toHaveBeenCalledWith(installed);
  });

  it('accepts an existing directory with spaces and opens it safely', async () => {
    const folder = 'E:\\Personal\\My Projects\\jarvis';
    const openPath = vi.fn(async () => '');
    await openFolder(folder, { stat: async () => ({ isDirectory: () => true }), openPath });
    expect(openPath).toHaveBeenCalledWith(folder);
  });

  it('reports missing folders without exposing a raw filesystem error', async () => {
    await expect(openFolder('C:\\Projects', { stat: async () => { throw new Error('ENOENT'); } })).rejects.toThrow('Folder not found: C:\\Projects');
  });

  it('rejects non-absolute paths before filesystem access', async () => {
    const stat = vi.fn();
    await expect(openFolder('Projects', { stat })).rejects.toThrow('Only absolute Windows folder paths are allowed.');
    expect(stat).not.toHaveBeenCalled();
  });
});
