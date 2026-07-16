import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const pdfPath = process.argv[2];
const buf = readFileSync(pdfPath);
const data = await pdfParse(buf);
console.log(data.text);
