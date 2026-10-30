import fs from 'fs';
import path from 'path';

export interface SyncLocalesOptions {
  sourceCommonDir?: string;
  sourceModulesDir?: string;
  targetDir?: string;
  languages?: string[];
  logger?: {
    log: (msg: string) => void;
    error: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string) => void;
  };
}

/**
 * Automatically aggregates translation files across modules and common translations into a single target directory.
 * - Source 1: Common translations (`src/common/translation/locales/{lang}/*.json`)
 * - Source 2: Module-level translations (`src/modules/{module}/translation/locales/{lang}/*.json`)
 *
 * This ensures modules keep domain translations localized while i18n loaders (or TranslationModule)
 * can access them centrally without file duplication.
 */
export function syncLocales(options?: SyncLocalesOptions): string {
  const root = process.cwd();
  const sourceModulesDir =
    options?.sourceModulesDir || path.join(root, 'src', 'modules');
  const targetDir =
    options?.targetDir ||
    path.join(root, 'src', 'common', 'translation', 'locales');
  const languages = options?.languages || ['en', 'ar'];
  const logger = options?.logger || console;

  try {
    for (const lang of languages) {
      const langTargetDir = path.join(targetDir, lang);
      if (!fs.existsSync(langTargetDir)) {
        fs.mkdirSync(langTargetDir, { recursive: true });
      }

      // Scan each module under src/modules and copy its translations into common locales
      if (fs.existsSync(sourceModulesDir)) {
        const moduleEntries = fs.readdirSync(sourceModulesDir, {
          withFileTypes: true,
        });

        for (const entry of moduleEntries) {
          if (entry.isDirectory()) {
            const moduleLocalesDir = path.join(
              sourceModulesDir,
              entry.name,
              'translation',
              'locales',
              lang,
            );

            if (fs.existsSync(moduleLocalesDir)) {
              const files = fs.readdirSync(moduleLocalesDir);
              for (const file of files) {
                if (file.endsWith('.json')) {
                  const srcFile = path.join(moduleLocalesDir, file);
                  const destFile = path.join(langTargetDir, file);
                  try {
                    let shouldCopy = true;
                    if (fs.existsSync(destFile)) {
                      const srcStat = fs.statSync(srcFile);
                      const destStat = fs.statSync(destFile);
                      if (srcStat.mtimeMs <= destStat.mtimeMs && srcStat.size === destStat.size) {
                        shouldCopy = false;
                      }
                    }
                    if (shouldCopy) {
                      fs.copyFileSync(srcFile, destFile);
                    }
                  } catch (err: any) {
                    if (err?.code !== 'EBUSY') {
                      throw err;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to sync translation locales:', error);
  }

  return targetDir;
}
