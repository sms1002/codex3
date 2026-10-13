(function () {
  function parse(text) {
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    const input = String(text).replace(/^\uFEFF/, '');

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (quoted) {
        if (char === '"' && input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
      } else if (char === '"' && field === '') {
        quoted = true;
      } else if (char === ',') {
        record.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[index + 1] === '\n') index += 1;
        record.push(field);
        if (record.some((value) => value.trim() !== '')) records.push(record);
        record = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error('닫히지 않은 따옴표가 있습니다.');
    record.push(field);
    if (record.some((value) => value.trim() !== '')) records.push(record);

    const columns = (records.shift() || []).map((value) => value.trim());
    if (columns.some((column) => !column)) throw new Error('빈 변수 이름이 있습니다.');
    if (new Set(columns).size !== columns.length) throw new Error('중복된 변수 이름이 있습니다.');
    if (records.some((values) => values.length !== columns.length)) throw new Error('행마다 열 개수가 다릅니다.');
    const rows = records.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ''])));
    return { columns, rows };
  }

  function encode(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function unparse(columns, rows) {
    return [columns.map(encode).join(','), ...rows.map((row) => columns.map((column) => encode(row[column])).join(','))].join('\r\n');
  }

  window.Csv = Object.freeze({ parse, unparse });
})();
