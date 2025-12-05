const fs = require('fs').promises;
let pdfParse = require('pdf-parse');
if (typeof pdfParse !== 'function') {
    if (pdfParse.default) {
        pdfParse = pdfParse.default;
    } else if (pdfParse.PDFParse) {
        pdfParse = pdfParse.PDFParse;
    }
}
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

        // Handle PDFParse class
        const ParserClass = pdfParse.PDFParse || pdfParse;

        // v2 usage: new PDFParse({ data: buffer })
        const parser = new ParserClass({ data: dataBuffer });
        const result = await parser.getText();
        await parser.destroy();

        return {
            text: result.text,
            pages: 0, // v2 might not expose pages count easily in result.text object, result has .text. 
            // result is TextResult { text: string, pages: ...? }
            // Let's assume result.text is what we want.
            metadata: {},
            rawData: result
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