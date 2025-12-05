const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

class DocumentParserService {
    async parseDocument(filePath, fileType) {
        try {
            switch (fileType) {
                case 'pdf':
                    return await this.parsePDF(filePath);
                case 'docx':
                    return await this.parseDOCX(filePath);
                case 'image':
                    return await this.parseImage(filePath);
                default:
                    throw new Error(`Unsupported file type: ${fileType}`);
            }
        } catch (error) {
            console.error('Document parsing error:', error);
            throw error;
        }
    }

    async parsePDF(filePath) {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);

        return {
            text: data.text,
            pages: data.numpages,
            metadata: data.info,
            rawData: data
        };
    }

    async parseDOCX(filePath) {
        const result = await mammoth.extractRawText({ path: filePath });

        return {
            text: result.value,
            messages: result.messages,
            rawData: result
        };
    }

    async parseImage(filePath) {
        const { data: { text } } = await Tesseract.recognize(
            filePath,
            'eng',
            {
                logger: m => console.log(m)
            }
        );

        return {
            text: text,
            rawData: { text }
        };
    }

    // Helper to clean extracted text
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
    }
}

module.exports = new DocumentParserService();