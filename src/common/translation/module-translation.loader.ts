import fs from 'fs';
import path from 'path';
import {
  I18nLoader,
  I18nTranslation,
  HeaderResolver,
  AcceptLanguageResolver,
  I18nModule,
} from 'nestjs-i18n';
import { DynamicModule, Module, Global } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface TranslationModuleOptions {
  fallbackLanguage?: string;
  modulesDir?: string;
}

/**
 * Custom loader that directly inspects module directories under `src/modules` (and/or `dist/modules`)
 * and loads their localized JSON translations without requiring any central `locales` folder.
 *
 * Folder structure per module:
 *   src/modules/<module-name>/translation/locales/<lang>/<file>.json
 *
 * For example:
 *   src/modules/auth/translation/locales/en/auth.json -> key: `auth.<KEY>`
 *   src/modules/user/translation/locales/ar/user.json -> key: `user.<KEY>`
 *
 * This ensures that adding or removing a module automatically adds or removes its translations
 * without touching any common translation directories.
 */
export class ModuleTranslationLoader extends I18nLoader {
  private languagesCache: string[] | null = null;
  private translationsCache: I18nTranslation | null = null;
  private readonly modulesDir: string;

  constructor(options?: { modulesDir?: string }) {
    super();
    const defaultModulesDir = path.join(process.cwd(), 'src', 'modules');
    const fallbackModulesDir = path.join(process.cwd(), 'dist', 'modules');

    if (options?.modulesDir && fs.existsSync(options.modulesDir)) {
      this.modulesDir = options.modulesDir;
    } else if (fs.existsSync(defaultModulesDir)) {
      this.modulesDir = defaultModulesDir;
    } else if (fs.existsSync(fallbackModulesDir)) {
      this.modulesDir = fallbackModulesDir;
    } else {
      this.modulesDir = defaultModulesDir;
    }
  }

  async languages(): Promise<string[] | Observable<string[]>> {
    if (this.languagesCache) {
      return this.languagesCache;
    }

    const langs = new Set<string>();

    if (fs.existsSync(this.modulesDir)) {
      const moduleDirs = fs.readdirSync(this.modulesDir, { withFileTypes: true });

      for (const mod of moduleDirs) {
        if (!mod.isDirectory()) continue;

        const localesDir = path.join(this.modulesDir, mod.name, 'translation', 'locales');
        if (fs.existsSync(localesDir)) {
          const langEntries = fs.readdirSync(localesDir, { withFileTypes: true });
          for (const langEntry of langEntries) {
            if (langEntry.isDirectory()) {
              langs.add(langEntry.name);
            }
          }
        }
      }
    }

    if (langs.size === 0) {
      langs.add('en');
      langs.add('ar');
    }

    this.languagesCache = Array.from(langs);
    return this.languagesCache;
  }

  async load(): Promise<I18nTranslation | Observable<I18nTranslation>> {
    if (this.translationsCache) {
      return this.translationsCache;
    }

    const translations: Record<string, Record<string, Record<string, unknown>>> = {};
    const languages = (await this.languages()) as string[];

    for (const lang of languages) {
      translations[lang] = {};
    }

    if (fs.existsSync(this.modulesDir)) {
      const moduleDirs = fs.readdirSync(this.modulesDir, { withFileTypes: true });

      for (const mod of moduleDirs) {
        if (!mod.isDirectory()) continue;

        const localesDir = path.join(this.modulesDir, mod.name, 'translation', 'locales');
        if (!fs.existsSync(localesDir)) continue;

        for (const lang of languages) {
          const langDir = path.join(localesDir, lang);
          if (!fs.existsSync(langDir)) continue;

          const files = fs.readdirSync(langDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const prefix = path.basename(file, '.json');
              const filePath = path.join(langDir, file);
              try {
                const raw = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(raw) as Record<string, unknown>;

                if (!translations[lang][prefix]) {
                  translations[lang][prefix] = {};
                }

                Object.assign(translations[lang][prefix], parsed);
              } catch {
                // Ignore malformed files or permission errors safely
              }
            }
          }
        }
      }
    }

    this.translationsCache = translations as unknown as I18nTranslation;
    return this.translationsCache;
  }
}

@Global()
@Module({})
export class AppTranslationModule {
  static forRoot(options?: TranslationModuleOptions): DynamicModule {
    const fallbackLanguage = options?.fallbackLanguage || 'en';

    return {
      module: AppTranslationModule,
      global: true,
      imports: [
        I18nModule.forRoot({
          fallbackLanguage,
          loader: ModuleTranslationLoader,
          loaderOptions: {
            modulesDir: options?.modulesDir,
          },
          resolvers: [
            new HeaderResolver(['x-lang']),
            new AcceptLanguageResolver(),
          ],
        }),
      ],
      exports: [I18nModule],
    };
  }
}

