import { writeFile } from 'node:fs/promises';
import { strToU8, zipSync } from 'fflate';

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export async function writeWorkbook(result, path) {
  const author = typeof result.source.author === 'object'
    ? result.source.author?.nickname || JSON.stringify(result.source.author)
    : result.source.author || '';
  const sheets = [
    {
      name: 'Overview', widths: [22, 80], rows: [
        ['Field', 'Value'], ['Title', result.source.title || ''],
        ['Platform', result.source.platform || ''], ['Original URL', result.source.originalUrl || ''],
        ['Canonical URL', result.source.canonicalUrl || ''], ['Author', author],
        ['Profile', `${result.profile.name} ${result.profile.version}`], ['Summary', result.summary]
      ]
    },
    {
      name: 'Sections', widths: [9, 18, 38, 24, 12, 12, 42, 70, 70, 12, 30, 48], freeze: true, filter: true,
      rows: [
        ['Order', 'Category', 'Definition', 'Title', 'Start (s)', 'End (s)', 'Summary', 'Cleaned text', 'Raw text', 'Confidence', 'Uncertainty', 'Source URL'],
        ...result.sections.map((section, index) => [
          index + 1, section.categoryLabel, section.categoryDefinition, section.title,
          section.startMs / 1000, section.endMs / 1000, section.summary, section.cleanedText,
          section.rawText, section.confidence, section.uncertainty || null,
          result.source.canonicalUrl || result.source.originalUrl || ''
        ])
      ]
    },
    {
      name: 'Transcript', widths: [9, 12, 12, 70, 70, 30], freeze: true, filter: true,
      rows: [
        ['Cue', 'Start (s)', 'End (s)', 'Raw text', 'Cleaned text', 'Uncertainty'],
        ...result.transcript.rawCues.map((cue, index) => [
          index, cue.startMs / 1000, cue.endMs / 1000, cue.text,
          result.transcript.cleanedCues[index].text,
          result.transcript.cleanedCues[index].uncertainty || null
        ])
      ]
    }
  ];
  const files = {
    '[Content_Types].xml': bytes(contentTypes(sheets.length)),
    '_rels/.rels': bytes(rootRelationships()),
    'docProps/app.xml': bytes(appProperties(sheets.map((sheet) => sheet.name))),
    'docProps/core.xml': bytes(coreProperties(result.generatedAt)),
    'xl/workbook.xml': bytes(workbookXml(sheets.map((sheet) => sheet.name))),
    'xl/_rels/workbook.xml.rels': bytes(workbookRelationships(sheets.length)),
    'xl/styles.xml': bytes(stylesXml())
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = bytes(sheetXml(sheet)); });
  await writeFile(path, zipSync(files, { level: 6 }));
}

const bytes = (value) => strToU8(value);
const escapeXml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

function columnName(index) {
  let value = index + 1, output = '';
  while (value) { value--; output = String.fromCharCode(65 + (value % 26)) + output; value = Math.floor(value / 26); }
  return output;
}

function cellXml(value, row, column, header) {
  if (value === null || value === undefined || value === '') return '';
  const ref = `${columnName(column)}${row}`;
  if (typeof value === 'number') return `<c r="${ref}" s="${column === 9 ? 4 : 3}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="${header ? 1 : 2}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(sheet) {
  const lastColumn = columnName(sheet.rows[0].length - 1);
  const rows = sheet.rows.map((values, index) => {
    const row = index + 1;
    const height = index === 0 ? 24 : sheet.name === 'Sections' ? 72 : sheet.name === 'Transcript' ? 30 : 36;
    return `<row r="${row}" ht="${height}" customHeight="1">${values.map((value, column) => cellXml(value, row, column, index === 0)).join('')}</row>`;
  }).join('');
  const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const pane = sheet.freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '';
  const filter = sheet.filter ? `<autoFilter ref="A1:${lastColumn}${sheet.rows.length}"/>` : '';
  return `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastColumn}${sheet.rows.length}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${columns}</cols><sheetData>${rows}</sheetData>${filter}</worksheet>`;
}

function contentTypes(count) {
  const sheets = Array.from({ length: count }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
  return `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${sheets}</Types>`;
}

function rootRelationships() {
  return `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function workbookXml(names) {
  const sheets = names.map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
  return `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelationships(count) {
  const sheets = Array.from({ length: count }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
  return `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function stylesXml() {
  return `${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function appProperties(names) {
  return `${xmlHeader}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>video-to-structured-material</Application><TitlesOfParts><vt:vector size="${names.length}" baseType="lpstr">${names.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`;
}

function coreProperties(generatedAt) {
  return `${xmlHeader}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>video-to-structured-material</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(generatedAt)}</dcterms:created></cp:coreProperties>`;
}
