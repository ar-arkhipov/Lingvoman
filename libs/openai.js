const OpenAI = require('openai');
const config = require('./config.js');

class OpenAIService {
    constructor() {
        if (!config.openaiApiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        
        this.openai = new OpenAI({
            apiKey: config.openaiApiKey
        });
    }

    /**
     * Translate a batch of UI text sections to Japanese
     * @param {Object} sections - Object containing key-value pairs to translate
     * @param {string} context - Additional context about the UI section
     * @returns {Promise<Object>} Translated sections with same structure
     */
    async translateSections(sections, context = '') {
        try {
            const sectionKeys = Object.keys(sections);
            const translatedSections = {};

            // Process each section individually for better context
            
            for (const sectionKey of sectionKeys) {
                const sectionContent = sections[sectionKey];

                console.log(`Translating section: ${sectionKey}`);
                
                const translatedContent = await this.translateSection(
                    sectionContent, 
                    `UI section: ${sectionKey}. ${context}`
                );
                
                translatedSections[sectionKey] = translatedContent;
                
            }

            return translatedSections;
        } catch (error) {
            console.error('Error in translateSections:', error);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    /**
     * Translate a single section (object with nested key-value pairs)
     * @param {Object} section - Section object to translate
     * @param {string} context - Context for this specific section
     * @returns {Promise<Object>} Translated section
     */
    async translateSection(section, context) {
        if (typeof section !== 'object' || section === null) {
            throw new Error('Section must be an object');
        }

        const translatedSection = {};
        const entries = Object.entries(section);

        // Filter out empty strings and batch translate all entries in this section
        const textsToTranslate = entries
            .filter(([key, value]) => {
                // Filter out empty strings, null, undefined, and whitespace-only strings
                return value && typeof value === 'string' && value.trim().length > 0;
            })
            .map(([key, value]) => ({
                key,
                text: value,
                context: `UI element: ${key}`
            }));

        if (textsToTranslate.length === 0) {
            console.log('No valid texts to translate in this section');

            return {}; // Return empty object if nothing to translate
        }

        const translatedTexts = await this.batchTranslate(textsToTranslate, context);

        // Reconstruct the section with ONLY translated values
        // Do not copy original English values that were filtered out
        translatedTexts.forEach(({ key, translatedText }) => {
            translatedSection[key] = translatedText;
        });

        return translatedSection;
    }

    /**
     * Batch translate multiple text strings
     * @param {Array} items - Array of {key, text, context} objects
     * @param {string} globalContext - Global context for the batch
     * @returns {Promise<Array>} Array of {key, translatedText} objects
     */
    async batchTranslate(items, globalContext = '') {
        try {
            const systemPrompt = `You are a professional UI/UX translator specializing in software interfaces. 

CRITICAL RULES:
1. Translate to Japanese while preserving the meaning and tone appropriate for software UI
2. Keep ALL placeholders, variables, and special characters EXACTLY as they appear (e.g., {name}, %s, {{variable}}, HTML tags)
3. Maintain the same level of formality - UI text should be concise and user-friendly
4. Preserve any technical terms that are commonly used in their English form in Japanese software
5. Keep the same text length when possible to avoid UI layout issues
6. If text contains HTML or special formatting, preserve it exactly
7. IMPORTANT: Only translate the "text" field, do NOT include any context information in your translation

Context: ${globalContext}

You will receive a JSON object where each key has an object with "text" and "context" fields.
Translate only the "text" field and return a JSON object with the same keys containing only the translated text.

Example input:
{
  "TITLE": {
    "text": "Title",
    "context": "UI element: TITLE"
  }
}

Example output:
{
  "TITLE": "タイトル"
}`;

            // Create the new format with separate text and context
            const translationData = items.reduce((acc, item) => {
                acc[item.key] = {
                    text: item.text,
                    context: item.context
                };

                return acc;
            }, {});

            const userPrompt = `Translate these UI texts to Japanese:\n\n${JSON.stringify(translationData, null, 2)}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1, // Low temperature for consistent translations
                max_tokens: 2000
            });

            const content = response.choices[0].message.content.trim();
            
            // Parse the JSON response
            let translations;

            try {
                translations = JSON.parse(content);
            } catch (parseError) {
                throw new Error(`Failed to parse OpenAI response as JSON: ${content}`);
            }

            // Convert back to the expected format
            return items.map((item) => ({
                key: item.key,
                translatedText: translations[item.key] || item.text // Fallback to original if translation missing
            }));

        } catch (error) {
            console.error('Error in batchTranslate:', error);
            throw error;
        }
    }

    /**
     * Validate that a translation preserves placeholders and structure
     * @param {string} original - Original text
     * @param {string} translated - Translated text
     * @returns {boolean} True if translation is valid
     */
    validateTranslation(original, translated) {
        // Check for common placeholder patterns
        const placeholderPatterns = [
            /\{[^}]+\}/g,           // {variable}
            /\{\{[^}]+\}\}/g,       // {{variable}}
            /%[sd%]/g,              // %s, %d, %%
            /<[^>]+>/g,             // HTML tags
            /\$\{[^}]+\}/g          // ${variable}
        ];

                 
         for (const pattern of placeholderPatterns) {
             const originalMatches = (original.match(pattern) || []).sort();
             const translatedMatches = (translated.match(pattern) || []).sort();
            
            if (JSON.stringify(originalMatches) !== JSON.stringify(translatedMatches)) {
                console.warn(`Placeholder mismatch in translation:
                    Original: ${original}
                    Translated: ${translated}
                    Expected placeholders: ${originalMatches.join(', ')}
                    Found placeholders: ${translatedMatches.join(', ')}`);

                return false;
            }
        }

        return true;
    }

    /**
     * Utility method to add delays between API calls
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = OpenAIService; 