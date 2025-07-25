/**
 * Flexible OpenAI Service - Language-Agnostic Translation
 */
const OpenAI = require('openai');
const config = require('./config.js');

class FlexibleOpenAIService {
    constructor() {
        this.isEnabled = !!config.openaiApiKey;
        
        if (this.isEnabled) {
            this.openai = new OpenAI({
                apiKey: config.openaiApiKey
            });
        } else {
            console.warn('OpenAI API key not provided. Translation features will be disabled.');
        }
    }

    /**
     * Translate sections to target language with progress tracking
     * @param {Object} sections - Sections to translate
     * @param {string} targetLocale - Target language code (e.g., 'fr', 'de', 'es')
     * @param {string} context - Translation context
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Translated sections
     */
    async translateSections(sections, targetLocale, context = '', progressCallback = null) {
        if (!this.isEnabled) {
            throw new Error('OpenAI API key not configured. Translation features are disabled.');
        }
        
        try {
            const sectionKeys = Object.keys(sections);
            const translatedSections = {};
            let processedSections = 0;

            for (const sectionKey of sectionKeys) {
                const sectionContent = sections[sectionKey];

                console.log(`Translating section: ${sectionKey} to ${targetLocale}`);
                
                // Update progress
                if (progressCallback) {
                    progressCallback({
                        step: `Translating section: ${sectionKey}`,
                        progress: Math.round((processedSections / sectionKeys.length) * 100),
                        currentSection: sectionKey,
                        totalSections: sectionKeys.length,
                        processedSections
                    });
                }
                
                const translatedContent = await this.translateSection(
                    sectionContent, 
                    targetLocale,
                    `UI section: ${sectionKey}. ${context}`
                );
                
                translatedSections[sectionKey] = translatedContent;
                processedSections++;
            }

            // Final progress update
            if (progressCallback) {
                progressCallback({
                    step: 'Translation completed',
                    progress: 100,
                    processedSections: sectionKeys.length,
                    totalSections: sectionKeys.length
                });
            }

            return translatedSections;
        } catch (error) {
            console.error('Error in translateSections:', error);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    /**
     * Translate a single section to target language
     * @param {Object} section - Section to translate
     * @param {string} targetLocale - Target language code
     * @param {string} context - Section context
     * @returns {Promise<Object>} Translated section
     */
    async translateSection(section, targetLocale, context) {
        if (!this.isEnabled) {
            throw new Error('OpenAI API key not configured. Translation features are disabled.');
        }
        
        if (typeof section !== 'object' || section === null) {
            throw new Error('Section must be an object');
        }

        const translatedSection = {};
        const entries = Object.entries(section);

        const textsToTranslate = entries.map(([key, value]) => ({
            key,
            text: value,
            context: `UI element: ${key}`
        }));

        const translatedTexts = await this.batchTranslate(textsToTranslate, targetLocale, context);

        translatedTexts.forEach(({ key, translatedText }) => {
            translatedSection[key] = translatedText;
        });

        return translatedSection;
    }

    /**
     * Batch translate multiple text strings to target language
     * @param {Array} items - Items to translate
     * @param {string} targetLocale - Target language code
     * @param {string} globalContext - Global context
     * @returns {Promise<Array>} Translated items
     */
    async batchTranslate(items, targetLocale, globalContext = '') {
        if (!this.isEnabled) {
            throw new Error('OpenAI API key not configured. Translation features are disabled.');
        }
        
        try {
            const systemPrompt = `You are a professional UI/UX translator specializing in software interfaces.

TARGET LANGUAGE: ${targetLocale} (locale code)

CRITICAL RULES:
- Translate to the language indicated by the locale code "${targetLocale}"
- Keep ALL placeholders, variables, and special characters EXACTLY as they appear (e.g., {name}, %s, {{variable}}, HTML tags)
- Maintain the same level of formality - UI text should be concise and user-friendly
- Keep the same text length when possible to avoid UI layout issues
- If text contains HTML or special formatting, preserve it exactly
- Do not translate technical identifiers, class names, or code elements
- Use appropriate formality level for software UI in the target language
- If the locale code is unfamiliar, use your best judgment to translate appropriately
- Return ONLY the translated text for each key, do NOT include any context information in the output
- The context provided is for your understanding only, do not include it in translations

Context: ${globalContext}

Return ONLY a JSON object with the translated texts, using the same keys as provided.`;

            const userPrompt = `Translate these UI texts to the language with locale code "${targetLocale}".

For context, here are the UI elements you're translating:
${items.map((item) => `- ${item.key}: "${item.text}" (${item.context})`).join('\n')}

Return as JSON with translated text only (no context in output):
${JSON.stringify(
                items.reduce((acc, item) => {
                    acc[item.key] = item.text;

                    return acc;
                }, {}),
                null,
                2
            )}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 20000
            });

            const content = response.choices[0].message.content.trim();
            
            let translations;

            try {
                translations = JSON.parse(content);
            } catch (parseError) {
                throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
            }

            return items.map((item) => ({
                key: item.key,
                translatedText: translations[item.key] || item.text
            }));

        } catch (error) {
            console.error('Error in batchTranslate:', error);
            throw error;
        }
    }

    /**
     * Validate translation quality
     * @param {string} original - Original text
     * @param {string} translated - Translated text
     * @returns {boolean} True if valid
     */
    validateTranslation(original, translated) {
        const placeholderPatterns = [
            /\{[^}]+\}/g,
            /\{\{[^}]+\}\}/g,
            /%[sd%]/g,
            /<[^>]+>/g,
            /\$\{[^}]+\}/g
        ];

        for (const pattern of placeholderPatterns) {
            const originalMatches = (original.match(pattern) || []).sort();
            const translatedMatches = (translated.match(pattern) || []).sort();
            
            if (JSON.stringify(originalMatches) !== JSON.stringify(translatedMatches)) {
                console.warn(`Placeholder mismatch in translation:
                    Original: ${original}
                    Translated: ${translated}`);

                return false;
            }
        }

        return true;
    }
}

module.exports = FlexibleOpenAIService; 
