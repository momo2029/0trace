// i18n - Internationalization System
class I18n {
    constructor() {
        this.currentLang = 'zh-CN';
        this.translations = {};
        this.supportedLangs = {
            'zh-CN': '简体中文',
            'en': 'English',
            'ja': '日本語',
            'ko': '한국어',
            'es': 'Español',
            'fr': 'Français'
        };
    }

    async init() {
        // Auto-detect browser language
        const browserLang = navigator.language || navigator.userLanguage;
        const savedLang = localStorage.getItem('lang');

        // Priority: saved > browser > default
        let targetLang = savedLang || this.normalizeLang(browserLang) || 'zh-CN';

        await this.loadLanguage(targetLang);
    }

    normalizeLang(lang) {
        // en-US -> en, zh-CN -> zh-CN
        if (lang.startsWith('zh')) return 'zh-CN';
        const base = lang.split('-')[0];
        return Object.keys(this.supportedLangs).find(l => l.startsWith(base)) || null;
    }

    async loadLanguage(lang) {
        if (!this.supportedLangs[lang]) {
            lang = 'zh-CN';
        }

        try {
            const response = await fetch(`/static/i18n/${lang}.json`);
            this.translations = await response.json();
            this.currentLang = lang;
            localStorage.setItem('lang', lang);
            this.updateUI();
        } catch (error) {
            console.error('Failed to load language:', error);
            if (lang !== 'zh-CN') {
                await this.loadLanguage('zh-CN');
            }
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) {
                console.warn(`Translation missing: ${key}`);
                return key;
            }
        }

        return value;
    }

    updateUI() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update title
        document.title = this.t('app.title');

        // Dispatch event for dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged'));
    }

    async switchLanguage(lang) {
        await this.loadLanguage(lang);
    }

    getCurrentLang() {
        return this.currentLang;
    }

    getSupportedLangs() {
        return this.supportedLangs;
    }
}

// Global instance
const i18n = new I18n();
