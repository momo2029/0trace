# 0trace Internationalization Plan

## 🌍 Recommended Languages

### Tier 1: Core Languages (Must-Have)

| Language | Code | Speakers | Priority | Reason |
|----------|------|----------|----------|--------|
| Simplified Chinese | zh-CN | 1.2B+ | ⭐⭐⭐⭐⭐ | Native, largest user base |
| English | en | 1.5B+ | ⭐⭐⭐⭐⭐ | International standard |
| Japanese | ja | 130M | ⭐⭐⭐⭐ | Active tech community |
| Korean | ko | 80M | ⭐⭐⭐⭐ | East Asian market |

### Tier 2: Important Languages (Recommended)

| Language | Code | Speakers | Priority | Reason |
|----------|------|----------|----------|--------|
| Spanish | es | 500M+ | ⭐⭐⭐ | Second largest native language |
| French | fr | 300M | ⭐⭐⭐ | Europe, Africa |
| German | de | 130M | ⭐⭐⭐ | European tech market |
| Russian | ru | 260M | ⭐⭐⭐ | Eastern Europe market |
| Portuguese | pt | 260M | ⭐⭐⭐ | Brazil market |

### Tier 3: Extended Languages (Optional)

| Language | Code | Speakers | Priority | Reason |
|----------|------|----------|----------|--------|
| Arabic | ar | 400M | ⭐⭐ | Middle East market |
| Hindi | hi | 600M | ⭐⭐ | India market |
| Italian | it | 85M | ⭐⭐ | European market |
| Traditional Chinese | zh-TW | 25M | ⭐⭐ | Taiwan, Hong Kong |

## 🎯 Recommended Solution

### Phase 1: Core 4 Languages
```
zh-CN (Simplified Chinese) - Default
en (English)
ja (日本語)
ko (한국어)
```

### Phase 2: Expand to 9 Languages
```
+ es (Español)
+ fr (Français)
+ de (Deutsch)
+ ru (Русский)
+ pt (Português)
```

## 🔧 Technical Implementation

### Option 1: Frontend-only i18n (Recommended)

**Pros**:
- ✅ Lightweight
- ✅ No backend changes needed
- ✅ Language switch without page reload

**Implementation**:
```javascript
// i18n.js
const translations = {
    'zh-CN': {
        'app.title': '0trace',
        'app.subtitle': '零隐私 · 点对点 · 无需注册',
        'send.title': '发送文件',
        'receive.title': '接收文件',
        // ...
    },
    'en': {
        'app.title': '0trace',
        'app.subtitle': 'Zero Privacy · P2P · No Registration',
        'send.title': 'Send Files',
        'receive.title': 'Receive Files',
        // ...
    }
};

function t(key) {
    const lang = localStorage.getItem('lang') || 'zh-CN';
    return translations[lang][key] || key;
}
```

### Option 2: Use i18next Library

**Pros**:
- ✅ Feature-complete
- ✅ Supports plurals, variables
- ✅ Mature community

**Cons**:
- ❌ Adds dependency (~10KB)

### Option 3: Server-side Rendering

**Pros**:
- ✅ SEO friendly

**Cons**:
- ❌ Requires backend modification
- ❌ Increases complexity

## 📝 Translation File Structure

```
frontend/static/
├── i18n/
│   ├── zh-CN.json    # Simplified Chinese
│   ├── en.json       # English
│   ├── ja.json       # Japanese
│   ├── ko.json       # Korean
│   ├── es.json       # Spanish
│   ├── fr.json       # French
│   ├── de.json       # German
│   ├── ru.json       # Russian
│   └── pt.json       # Portuguese
└── i18n.js           # i18n core
```

## 🎨 UI Design

### Language Switcher Position

**Option 1: Top-right Header**
```
🔒 0trace                    [🌐 中文 ▼]
Zero Privacy · P2P · No Registration
```

**Option 2: Footer**
```
Based on WebRTC P2P · Server stores no files
Language: [中文] [English] [日本語] [한국어]
```

**Option 3: Floating Button**
```
Fixed button in bottom-right:
[🌐]
```

## 📊 Reference Data

### GitHub Project Language Distribution

| Language | Percentage | Notes |
|----------|------------|-------|
| English | 80% | Absolute majority |
| Chinese | 8% | Fastest growing |
| Japanese | 3% | Active tech community |
| Other | 9% | Scattered |

### Similar Projects' Language Support

**LocalSend**:
- Supports 50+ languages
- Uses Flutter i18n
- Community translations

**Snapdrop**:
- English only
- Simple and straightforward

**ShareDrop**:
- Primarily English
- Partial multilingual support

## 💡 Recommendations

### Minimum Viable Product (MVP)

**Support 2 languages**:
```
zh-CN (Simplified Chinese) - Default
en (English) - International
```

**Implementation Cost**:
- Translation work: 2-3 hours
- Development work: 3-4 hours
- Testing work: 1 hour

### Full Solution

**Support 9 languages**:
```
Core: zh-CN, en, ja, ko
Extended: es, fr, de, ru, pt
```

**Implementation Cost**:
- Translation work: 1-2 days (AI-assisted possible)
- Development work: 4-6 hours
- Testing work: 2-3 hours

## 🚀 Implementation Steps

### Step 1: Core Functionality
1. Create i18n system
2. Extract all text
3. Translate to English
4. Add language switcher

### Step 2: Extended Languages
1. Use AI translation (ChatGPT/DeepL)
2. Community contributions
3. Professional proofreading (optional)

### Step 3: Optimization
1. Auto-detect browser language
2. Remember user preference
3. URL parameter support (?lang=en)

## 🎯 Recommended Approach for 0trace

**Phase 1 (Immediate)**:
- Support: zh-CN + en
- Approach: Pure frontend i18n
- Location: Top-right header

**Phase 2 (Later)**:
- Add: ja, ko, es, fr
- Method: Community contributions
- Tool: AI-assisted translation

**Reasoning**:
- 0trace has simple UI with minimal text
- Pure frontend implementation, no backend changes needed
- English covers international users
- Chinese maintains local advantage

Would you like me to implement the multilingual support now?
