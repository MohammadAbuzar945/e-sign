type JsonObject = Record<string, unknown>;

const BINARY_FILE_SCHEMA = Object.freeze({ type: 'string', format: 'binary' });

const isEmptyObjectSchema = (schema: unknown): boolean => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return false;
  }

  return Object.keys(schema as JsonObject).length === 0;
};

const patchMultipartSchema = (schema: unknown) => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return;
  }

  const root = schema as JsonObject;
  const properties = root.properties;

  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return;
  }

  const props = properties as JsonObject;

  if (isEmptyObjectSchema(props.file)) {
    props.file = { ...BINARY_FILE_SCHEMA };
  }

  const filesProp = props.files;

  if (
    filesProp &&
    typeof filesProp === 'object' &&
    !Array.isArray(filesProp) &&
    (filesProp as JsonObject).type === 'array'
  ) {
    const items = (filesProp as JsonObject).items;

    // Missing `items` or `{}` → Swagger UI shows `array<undefined>` and a text field.
    if (items === undefined || isEmptyObjectSchema(items)) {
      (filesProp as JsonObject).items = { ...BINARY_FILE_SCHEMA };
    }
  }
};

/**
 * `trpc-to-openapi` + Zod `zfd.file()` produce empty JSON Schema objects for file
 * parts, so Swagger UI does not render file pickers. OpenAPI 3 expects
 * `type: string` + `format: binary` for each multipart file field.
 */
export const patchOpenApiMultipartFileParts = (doc: JsonObject) => {
  const paths = doc.paths;

  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
    return;
  }

  for (const pathItem of Object.values(paths as JsonObject)) {
    if (!pathItem || typeof pathItem !== 'object' || Array.isArray(pathItem)) {
      continue;
    }

    for (const op of Object.values(pathItem as JsonObject)) {
      if (!op || typeof op !== 'object' || Array.isArray(op)) {
        continue;
      }

      const requestBody = (op as JsonObject).requestBody;

      if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
        continue;
      }

      const content = (requestBody as JsonObject).content;

      if (!content || typeof content !== 'object' || Array.isArray(content)) {
        continue;
      }

      const multipart = (content as JsonObject)['multipart/form-data'];

      if (!multipart || typeof multipart !== 'object' || Array.isArray(multipart)) {
        continue;
      }

      patchMultipartSchema((multipart as JsonObject).schema);
    }
  }
};
