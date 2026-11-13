// Kleine Schema-Prüfung für gespeicherte Daten, Importe und (später)
// Agent-Aktionen. Gibt eine Liste lesbarer Fehler zurück, leer = gültig.
//
// Schema-Arten:
//   { type: 'string', max, min, enum, pattern }
//   { type: 'number', min, max, integer, enum }
//   { type: 'boolean' }
//   { type: 'array', items, min, max, unique }
//   { type: 'object', props: { name: schema }, required: [..], loose }
// Unbekannte Felder in Objekten sind Fehler, außer bei loose: true.

export function validate(value, schema, path = '') {
  const errors = [];
  check(value, schema, path || 'Wert', errors);
  return errors;
}

function check(value, schema, path, errors) {
  switch (schema.type) {
    case 'string':
      return checkString(value, schema, path, errors);
    case 'number':
      return checkNumber(value, schema, path, errors);
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(`${path}: Ja/Nein erwartet`);
      return;
    case 'array':
      return checkArray(value, schema, path, errors);
    case 'object':
      return checkObject(value, schema, path, errors);
    default:
      throw new Error(`Unbekannter Schema-Typ: ${schema.type}`);
  }
}

function checkString(value, schema, path, errors) {
  if (typeof value !== 'string') return errors.push(`${path}: Text erwartet`);
  if (schema.min != null && value.length < schema.min) errors.push(`${path}: zu kurz`);
  if (schema.max != null && value.length > schema.max) errors.push(`${path}: zu lang`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: unerlaubter Wert "${value}"`);
  if (schema.pattern && !schema.pattern.test(value)) errors.push(`${path}: falsches Format`);
}

function checkNumber(value, schema, path, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return errors.push(`${path}: Zahl erwartet`);
  }
  if (schema.integer && !Number.isInteger(value)) errors.push(`${path}: ganze Zahl erwartet`);
  if (schema.min != null && value < schema.min) errors.push(`${path}: zu klein`);
  if (schema.max != null && value > schema.max) errors.push(`${path}: zu groß`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: unerlaubter Wert ${value}`);
}

function checkArray(value, schema, path, errors) {
  if (!Array.isArray(value)) return errors.push(`${path}: Liste erwartet`);
  if (schema.min != null && value.length < schema.min) errors.push(`${path}: zu wenige Einträge`);
  if (schema.max != null && value.length > schema.max) errors.push(`${path}: zu viele Einträge`);
  if (schema.unique && new Set(value).size !== value.length) errors.push(`${path}: doppelte Einträge`);
  value.forEach((item, i) => check(item, schema.items, `${path}[${i}]`, errors));
}

function checkObject(value, schema, path, errors) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return errors.push(`${path}: Objekt erwartet`);
  }
  for (const key of schema.required ?? []) {
    if (!(key in value)) errors.push(`${path}.${key}: fehlt`);
  }
  for (const [key, inner] of Object.entries(value)) {
    const propSchema = schema.props[key];
    if (propSchema) check(inner, propSchema, `${path}.${key}`, errors);
    else if (!schema.loose) errors.push(`${path}.${key}: unbekanntes Feld`);
  }
}
