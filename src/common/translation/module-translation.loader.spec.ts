import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { describe, it, expect, beforeAll } from 'vitest';
import { AppTranslationModule } from './module-translation.loader.js';

describe('AppTranslationModule and ModuleTranslationLoader', () => {
  let i18nService: I18nService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        AppTranslationModule.forRoot({
          fallbackLanguage: 'en',
        }),
      ],
    }).compile();

    i18nService = moduleRef.get<I18nService>(I18nService);
  });

  it('should be defined and successfully inject I18nService', () => {
    expect(i18nService).toBeDefined();
  });

  it('should translate auth keys from src/modules/auth in English', async () => {
    const translated = await i18nService.t('auth.LOGIN_SUCCESS', { lang: 'en' });
    expect(translated).toBe('Login successful');
  });

  it('should translate auth keys in Arabic', async () => {
    const translated = await i18nService.t('auth.LOGIN_SUCCESS', { lang: 'ar' });
    expect(translated).toBe('تم تسجيل الدخول بنجاح');
  });

  it('should translate media keys from src/modules/media in English', async () => {
    const translated = await i18nService.t('media.UPLOAD_URL_GENERATED', { lang: 'en' });
    expect(translated).toBe('Upload URL generated successfully');
  });

  it('should translate media keys in Arabic', async () => {
    const translated = await i18nService.t('media.UPLOAD_URL_GENERATED', { lang: 'ar' });
    expect(translated).toBe('تم إنشاء رابط الرفع بنجاح');
  });

  it('should translate user keys from src/modules/user in English', async () => {
    const translated = await i18nService.t('user.NOT_FOUND', { lang: 'en' });
    expect(translated).toBe('User not found');
  });

  it('should translate notification keys from src/modules/notification in English', async () => {
    const translated = await i18nService.t('notification.SENT_SUCCESS', { lang: 'en' });
    expect(translated).toBe('Notification sent successfully');
  });

  it('should translate payment keys from src/modules/payment in English', async () => {
    const translated = await i18nService.t('payment.INITIATE_SUCCESS', { lang: 'en' });
    expect(translated).toBe('Payment initiated successfully');
  });

  it('should translate realtime keys from src/modules/realtime in English', async () => {
    const translated = await i18nService.t('realtime.ROOM_JOINED', { lang: 'en' });
    expect(translated).toBe('Joined room successfully');
  });
});
