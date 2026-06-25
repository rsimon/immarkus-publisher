import { readFile } from 'fs/promises';
import { resolve } from 'path';
import yaml from 'js-yaml';

export interface Config {
  baseUrl: string;
  title: string;
  sourceDir: string;
  outputDir: string;
  language: string;
}

const DEFAULTS: Partial<Config> = {
  language: 'en',
  sourceDir: './source',
  outputDir: './dist',
  title: 'IMMARKUS Collection',
};

export async function loadConfig(configPath: string): Promise<Config> {
  const raw = await readFile(configPath, 'utf-8');
  const parsed = yaml.load(raw) as Partial<Config>;

  const config: Config = {
    ...DEFAULTS,
    ...parsed,
  } as Config;

  // Resolve paths relative to the config file's directory
  const configDir = resolve(configPath, '..');
  config.sourceDir = resolve(configDir, config.sourceDir);
  config.outputDir = resolve(configDir, config.outputDir);

  // Normalise baseUrl: strip trailing slash
  config.baseUrl = config.baseUrl.replace(/\/$/, '');

  if (!config.baseUrl) {
    throw new Error(
      'Please set a baseUrl in config.yaml before publishing.'
    );
  }

  return config;
}
